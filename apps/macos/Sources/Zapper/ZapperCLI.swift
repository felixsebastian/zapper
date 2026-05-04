import Foundation

enum ZapperCLIError: LocalizedError {
    case notFound
    case failed(command: String, status: Int32, stderr: String)
    case invalidOutput(String)

    var errorDescription: String? {
        switch self {
        case .notFound:
            return "Could not find the zap CLI. Set ZAPPER_CLI_PATH or make zap available in your login shell."
        case let .failed(command, status, stderr):
            let detail = stderr.trimmingCharacters(in: .whitespacesAndNewlines)
            return detail.isEmpty
                ? "\(command) failed with exit code \(status)."
                : "\(command) failed with exit code \(status): \(detail)"
        case let .invalidOutput(message):
            return message
        }
    }
}

struct ZapperCLI {
    func loadProjects() async throws -> [ZapperProject] {
        try await Task.detached(priority: .userInitiated) {
            let zapPath = try Self.resolveZapPath()
            let output = try Self.run(executable: zapPath, arguments: ["system", "projects", "--json"])
            let decoder = JSONDecoder()
            do {
                return try decoder.decode(SystemProjectsResponse.self, from: output).projects
            } catch {
                throw ZapperCLIError.invalidOutput("zap returned JSON that the app could not read: \(error.localizedDescription)")
            }
        }.value
    }

    func loadHomepage(configPath: String, instanceKey: String) async throws -> String {
        try await Task.detached(priority: .userInitiated) {
            let zapPath = try Self.resolveZapPath()
            let output = try Self.run(
                executable: zapPath,
                arguments: [
                    "--config", configPath,
                    "--instance", instanceKey,
                    "home",
                    "--json"
                ]
            )
            do {
                return try JSONDecoder().decode(ZapperHomeResponse.self, from: output).value
            } catch {
                throw ZapperCLIError.invalidOutput("zap home returned JSON that the app could not read: \(error.localizedDescription)")
            }
        }.value
    }

    func runServiceAction(
        action: ZapperServiceAction,
        configPath: String,
        instanceKey: String,
        service: String? = nil
    ) async throws {
        try await Task.detached(priority: .userInitiated) {
            let zapPath = try Self.resolveZapPath()
            var arguments = [
                "--config", configPath,
                "--instance", instanceKey,
                action.rawValue
            ]
            if let service {
                arguments.append(service)
            }
            arguments.append("--json")
            _ = try Self.run(executable: zapPath, arguments: arguments)
        }.value
    }

    private static func resolveZapPath() throws -> String {
        let environment = ProcessInfo.processInfo.environment
        if let explicitPath = environment["ZAPPER_CLI_PATH"], isExecutable(explicitPath) {
            return explicitPath
        }

        let commonPaths = [
            "/opt/homebrew/bin/zap",
            "/usr/local/bin/zap",
            "\(NSHomeDirectory())/.local/bin/zap"
        ]
        if let path = commonPaths.first(where: isExecutable) {
            return path
        }

        let shellOutput = try? run(
            executable: "/bin/zsh",
            arguments: ["-lc", "command -v zap"]
        )
        if let shellOutput,
           let path = String(data: shellOutput, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !path.isEmpty,
           isExecutable(path) {
            return path
        }

        throw ZapperCLIError.notFound
    }

    private static func isExecutable(_ path: String) -> Bool {
        FileManager.default.isExecutableFile(atPath: path)
    }

    private static func run(executable: String, arguments: [String]) throws -> Data {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments

        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr

        try process.run()
        process.waitUntilExit()

        let output = stdout.fileHandleForReading.readDataToEndOfFile()
        let errorOutput = stderr.fileHandleForReading.readDataToEndOfFile()

        guard process.terminationStatus == 0 else {
            let stderrText = String(data: errorOutput, encoding: .utf8) ?? ""
            throw ZapperCLIError.failed(
                command: ([executable] + arguments).joined(separator: " "),
                status: process.terminationStatus,
                stderr: stderrText
            )
        }

        return output
    }
}

enum ZapperServiceAction: String {
    case up
    case down
}
