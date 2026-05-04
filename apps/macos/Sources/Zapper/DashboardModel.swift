import Combine
import Foundation

@MainActor
final class DashboardModel: ObservableObject {
    @Published private(set) var projects: [ZapperProject] = []
    @Published private(set) var homepages: [String: String] = [:]
    @Published private(set) var isRefreshing = false
    @Published private(set) var actionInFlight: String?
    @Published private(set) var lastUpdated: Date?
    @Published private(set) var errorMessage: String?
    @Published private(set) var actionMessage: String?

    private let cli = ZapperCLI()

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
            await refreshHomepages(for: loadedProjects)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func homepage(for project: ZapperProject, instance: ZapperInstance) -> String? {
        homepages[homepageKey(project: project, instanceKey: instance.instanceKey)]
    }

    func startInstance(_ instance: ZapperInstance, in project: ZapperProject) async {
        await runAction(.up, project: project, instance: instance)
    }

    func stopInstance(_ instance: ZapperInstance, in project: ZapperProject) async {
        await runAction(.down, project: project, instance: instance)
    }

    func startService(_ service: ZapperService, instance: ZapperInstance, project: ZapperProject) async {
        await runAction(.up, project: project, instance: instance, service: service.service)
    }

    func stopService(_ service: ZapperService, instance: ZapperInstance, project: ZapperProject) async {
        await runAction(.down, project: project, instance: instance, service: service.service)
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

    private func refreshHomepages(for projects: [ZapperProject]) async {
        var loadedHomepages: [String: String] = [:]

        for project in projects {
            for instance in project.instances {
                let key = homepageKey(project: project, instanceKey: instance.instanceKey)
                if let homepage = try? await cli.loadHomepage(
                    configPath: project.configPath,
                    instanceKey: instance.instanceKey
                ) {
                    loadedHomepages[key] = homepage
                }
            }
        }

        homepages = loadedHomepages
    }

    private func homepageKey(project: ZapperProject, instanceKey: String) -> String {
        "\(project.registryId):\(instanceKey)"
    }
}
