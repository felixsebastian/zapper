import AppKit
import SwiftUI

struct DashboardView: View {
    @ObservedObject var model: DashboardModel

    var body: some View {
        VStack(spacing: 0) {
            HeaderView(model: model)
            Divider()
            content
            Divider()
            FooterView(model: model)
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }

    @ViewBuilder
    private var content: some View {
        if let errorMessage = model.errorMessage, model.projects.isEmpty {
            ErrorView(message: errorMessage) {
                Task { await model.refresh() }
            } chooseZap: {
                model.chooseZapCLI()
            }
        } else if model.projects.isEmpty {
            EmptyStateView(isRefreshing: model.isRefreshing)
        } else {
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(model.projects) { project in
                        ProjectRow(project: project, model: model)
                    }
                }
                .padding(12)
            }
        }
    }
}

private struct HeaderView: View {
    @ObservedObject var model: DashboardModel

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: model.menuSystemImage)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(statusColor(counts: model.counts, error: model.errorMessage))
                .frame(width: 24, height: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text("Zapper")
                    .font(.headline)
                Text(summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                model.chooseZapCLI()
            } label: {
                Image(systemName: "terminal")
            }
            .buttonStyle(.borderless)
            .help("Choose zap CLI")

            Button {
                Task { await model.refresh() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.borderless)
            .disabled(model.isRefreshing)
            .help("Refresh")
        }
        .padding(12)
    }

    private var summary: String {
        let counts = model.counts
        if model.isRefreshing {
            return "Refreshing..."
        }
        if counts.total == 0 {
            return "No services loaded"
        }
        return "\(counts.up) up, \(counts.pending) pending, \(counts.down) down"
    }
}

private struct FooterView: View {
    @ObservedObject var model: DashboardModel

    var body: some View {
        HStack {
            if let lastUpdated = model.lastUpdated {
                Text("Updated \(lastUpdated.formatted(date: .omitted, time: .shortened))")
                    .foregroundStyle(.secondary)
            } else {
                Text("Not updated yet")
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if let configuredZapPath = model.configuredZapPath {
                Text("CLI \(URL(fileURLWithPath: configuredZapPath).lastPathComponent)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .help(configuredZapPath)

                Button("Clear CLI") {
                    model.clearZapCLIOverride()
                }
                .buttonStyle(.borderless)
            }

            if let actionMessage = model.actionMessage {
                Text(actionMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .buttonStyle(.borderless)
        }
        .font(.caption)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

private struct ProjectRow: View {
    let project: ZapperProject
    @ObservedObject var model: DashboardModel

    var body: some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(project.projectRoot)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer()
                    Button {
                        NSWorkspace.shared.open(URL(fileURLWithPath: project.projectRoot))
                    } label: {
                        Image(systemName: "folder")
                    }
                    .buttonStyle(.borderless)
                    .help("Open project folder")
                }

                if let error = project.error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                ForEach(project.instances) { instance in
                    InstanceRow(project: project, instance: instance, model: model)
                }
            }
            .padding(.top, 8)
        } label: {
            HStack(spacing: 8) {
                Circle()
                    .fill(projectStateColor(project.state))
                    .frame(width: 8, height: 8)

                VStack(alignment: .leading, spacing: 2) {
                    Text(project.project)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Text(project.state)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                CountStrip(counts: project.counts)
            }
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct InstanceRow: View {
    let project: ZapperProject
    let instance: ZapperInstance
    @ObservedObject var model: DashboardModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(instance.instanceKey)
                    .font(.caption.weight(.semibold))
                Text(instance.instanceId)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
                CountStrip(counts: instance.counts)
            }

            HStack(spacing: 8) {
                Button("Start") {
                    Task { await model.startInstance(instance, in: project) }
                }
                .disabled(model.actionInFlight != nil)

                Button("Stop") {
                    Task { await model.stopInstance(instance, in: project) }
                }
                .disabled(model.actionInFlight != nil)

                if let homepage = model.homepage(for: project, instance: instance),
                   let url = URL(string: homepage) {
                    Button("Open Home") {
                        NSWorkspace.shared.open(url)
                    }
                    .help(homepage)
                }
            }
            .buttonStyle(.borderless)

            if let error = instance.error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            ForEach(instance.services) { service in
                ServiceRow(
                    service: service,
                    instance: instance,
                    project: project,
                    model: model
                )
            }
        }
        .padding(8)
        .background(Color(nsColor: .textBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }
}

private struct ServiceRow: View {
    let service: ZapperService
    let instance: ZapperInstance
    let project: ZapperProject
    @ObservedObject var model: DashboardModel

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(serviceStatusColor(service.status))
                .frame(width: 7, height: 7)
            Text(service.service)
                .font(.caption)
                .lineLimit(1)
            Text(service.type)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Spacer()
            Button("Start") {
                Task {
                    await model.startService(service, instance: instance, project: project)
                }
            }
            .disabled(model.actionInFlight != nil)
            Button("Stop") {
                Task {
                    await model.stopService(service, instance: instance, project: project)
                }
            }
            .disabled(model.actionInFlight != nil)
        }
        .buttonStyle(.borderless)
    }
}

private struct CountStrip: View {
    let counts: ServiceCounts

    var body: some View {
        HStack(spacing: 4) {
            CountPill(value: counts.up, color: .green)
            CountPill(value: counts.pending, color: .orange)
            CountPill(value: counts.down, color: .secondary)
        }
    }
}

private struct CountPill: View {
    let value: Int
    let color: Color

    var body: some View {
        Text("\(value)")
            .font(.caption2.monospacedDigit())
            .foregroundStyle(color)
            .frame(minWidth: 18)
    }
}

private struct ErrorView: View {
    let message: String
    let retry: () -> Void
    let chooseZap: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.orange)
            Text(message)
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 24)
            HStack(spacing: 10) {
                Button("Choose zap", action: chooseZap)
                Button("Retry", action: retry)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct EmptyStateView: View {
    let isRefreshing: Bool

    var body: some View {
        VStack(spacing: 8) {
            ProgressView()
                .opacity(isRefreshing ? 1 : 0)
            Text(isRefreshing ? "Loading projects..." : "No registered projects")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private func statusColor(counts: ServiceCounts, error: String?) -> Color {
    if error != nil {
        return .orange
    }
    if counts.pending > 0 {
        return .orange
    }
    if counts.up > 0 {
        return .green
    }
    return .secondary
}

private func projectStateColor(_ state: String) -> Color {
    switch state {
    case "active":
        return .green
    case "unresolved", "stale":
        return .orange
    default:
        return .secondary
    }
}

private func serviceStatusColor(_ status: String) -> Color {
    switch status {
    case "up":
        return .green
    case "pending":
        return .orange
    default:
        return .secondary
    }
}
