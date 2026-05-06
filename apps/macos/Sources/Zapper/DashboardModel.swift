import Combine
import Foundation
import AppKit

@MainActor
final class DashboardModel: ObservableObject {
    private static let pinnedStackIDsKey = "ZapperPinnedStackIDs"

    @Published private(set) var projects: [ZapperProject] = []
    @Published private(set) var homepages: [String: String] = [:]
    @Published private(set) var links: [String: [ZapperProjectLink]] = [:]
    @Published private(set) var isRefreshing = false
    @Published private(set) var actionInFlight: String?
    @Published private(set) var lastUpdated: Date?
    @Published private(set) var errorMessage: String?
    @Published private(set) var actionMessage: String?
    @Published private(set) var configuredZapPath: String?
    @Published private(set) var pinnedStackIDs: Set<String> = []

    private let cli = ZapperCLI()

    init() {
        configuredZapPath = ZapperCLI.savedZapPath
        pinnedStackIDs = Set(UserDefaults.standard.stringArray(forKey: Self.pinnedStackIDsKey) ?? [])
    }

    var counts: ServiceCounts {
        projects.reduce(.empty) { partial, project in
            partial + project.counts
        }
    }

    var menuTitle: String {
        let counts = counts
        if counts.total == 0 {
            return "Zapper"
        }
        if counts.pending > 0 {
            return "\(counts.up) up, \(counts.pending) pending"
        }
        return "\(counts.up) up"
    }

    var menuSystemImage: String {
        let counts = counts
        if errorMessage != nil {
            return "bolt.trianglebadge.exclamationmark"
        }
        if counts.pending > 0 {
            return "bolt.badge.clock"
        }
        if counts.down > 0 && counts.up == 0 {
            return "bolt.slash"
        }
        return "bolt.fill"
    }

    func refresh() async {
        if isRefreshing {
            return
        }

        isRefreshing = true
        defer { isRefreshing = false }

        do {
            let loadedProjects = try await cli.loadProjects()
            projects = loadedProjects
            lastUpdated = Date()
            errorMessage = nil
            await refreshLinks(for: loadedProjects)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func homepage(for project: ZapperProject, instance: ZapperInstance) -> String? {
        links(for: project, instance: instance).first(where: \.isHomepage)?.url
            ?? homepages[homepageKey(project: project, instanceKey: instance.instanceKey)]
    }

    func links(for project: ZapperProject, instance: ZapperInstance) -> [ZapperProjectLink] {
        links[homepageKey(project: project, instanceKey: instance.instanceKey)] ?? []
    }

    func startInstance(_ instance: ZapperInstance, in project: ZapperProject) async {
        await runAction(.up, project: project, instance: instance)
    }

    func stopInstance(_ instance: ZapperInstance, in project: ZapperProject) async {
        await runAction(.down, project: project, instance: instance)
    }

    func restartInstance(_ instance: ZapperInstance, in project: ZapperProject) async {
        await runAction(.restart, project: project, instance: instance)
    }

    func startService(_ service: ZapperService, instance: ZapperInstance, project: ZapperProject) async {
        await runAction(.up, project: project, instance: instance, service: service.service)
    }

    func stopService(_ service: ZapperService, instance: ZapperInstance, project: ZapperProject) async {
        await runAction(.down, project: project, instance: instance, service: service.service)
    }

    func restartService(_ service: ZapperService, instance: ZapperInstance, project: ZapperProject) async {
        await runAction(.restart, project: project, instance: instance, service: service.service)
    }

    func chooseZapCLI() {
        NSApplication.shared.activate(ignoringOtherApps: true)

        let panel = NSOpenPanel()
        panel.title = "Choose zap CLI"
        panel.message = "Choose the zap executable installed by pnpm, npm, or Homebrew."
        panel.prompt = "Use zap"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.treatsFilePackagesAsDirectories = true

        guard panel.runModal() == .OK, let path = panel.url?.path else {
            return
        }

        do {
            try ZapperCLI.saveZapPath(path)
            configuredZapPath = path
            actionMessage = "Using zap at \(path)"
            errorMessage = nil
            Task { await refresh() }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearZapCLIOverride() {
        ZapperCLI.clearSavedZapPath()
        configuredZapPath = nil
        actionMessage = "Cleared zap CLI override"
        Task { await refresh() }
    }

    func isPinned(stackID: String) -> Bool {
        pinnedStackIDs.contains(stackID)
    }

    func togglePin(stackID: String) {
        if pinnedStackIDs.contains(stackID) {
            pinnedStackIDs.remove(stackID)
        } else {
            pinnedStackIDs.insert(stackID)
        }
        UserDefaults.standard.set(Array(pinnedStackIDs).sorted(), forKey: Self.pinnedStackIDsKey)
    }

    private func runAction(
        _ action: ZapperServiceAction,
        project: ZapperProject,
        instance: ZapperInstance,
        service: String? = nil
    ) async {
        if actionInFlight != nil {
            return
        }

        let target = service ?? instance.instanceKey
        actionInFlight = "\(action.rawValue):\(project.registryId):\(instance.instanceKey):\(service ?? "*")"
        actionMessage = "\(action.rawValue) \(project.project)/\(target)"
        defer { actionInFlight = nil }

        do {
            try await cli.runServiceAction(
                action: action,
                configPath: project.configPath,
                instanceKey: instance.instanceKey,
                service: service
            )
            actionMessage = "Completed \(action.rawValue) \(project.project)/\(target)"
            await refresh()
        } catch {
            actionMessage = error.localizedDescription
        }
    }

    private func refreshLinks(for projects: [ZapperProject]) async {
        var loadedHomepages: [String: String] = [:]
        var loadedLinks: [String: [ZapperProjectLink]] = [:]

        for project in projects {
            for instance in project.instances {
                let key = homepageKey(project: project, instanceKey: instance.instanceKey)
                if let links = try? await cli.loadLinks(
                    configPath: project.configPath,
                    instanceKey: instance.instanceKey
                ) {
                    loadedLinks[key] = links
                    if let homepage = links.first(where: \.isHomepage)?.url {
                        loadedHomepages[key] = homepage
                    }
                }
            }
        }

        homepages = loadedHomepages
        links = loadedLinks
    }

    private func homepageKey(project: ZapperProject, instanceKey: String) -> String {
        "\(project.registryId):\(instanceKey)"
    }
}
