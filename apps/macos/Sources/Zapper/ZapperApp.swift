import AppKit
import Combine
import SwiftUI

@main
@MainActor
final class ZapperMenuBarApp: NSObject, NSApplicationDelegate {
    private let model = DashboardModel()
    private let popover = NSPopover()
    private var statusItem: NSStatusItem?
    private var cancellables = Set<AnyCancellable>()
    private var pollTask: Task<Void, Never>?
    private var recentlyOpenedUntil = Date.distantPast

    static func main() {
        let app = NSApplication.shared
        let delegate = ZapperMenuBarApp()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        app.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        configureStatusItem()
        configurePopover()
        observeModel()
        updateStatusItem()
        restartPolling()

        Task {
            await model.refresh()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        pollTask?.cancel()
    }

    private func configureStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            button.action = #selector(togglePopover(_:))
            button.target = self
            button.imagePosition = .imageLeading
            button.imageHugsTitle = true
        }
        statusItem = item
    }

    private func configurePopover() {
        popover.behavior = .transient
        popover.contentSize = NSSize(width: 420, height: 120)
        popover.contentViewController = NSHostingController(
            rootView: DashboardView(model: model) { [weak self] height in
                self?.resizePopover(height: height)
            }
        )
    }

    private func resizePopover(height: CGFloat) {
        let clampedHeight = min(max(120, ceil(height)), 560)
        let newSize = NSSize(width: 420, height: clampedHeight)
        if abs(popover.contentSize.height - newSize.height) > 1 {
            popover.contentSize = newSize
        }
    }

    private func observeModel() {
        model.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                Task { @MainActor in
                    self?.updateStatusItem()
                }
            }
            .store(in: &cancellables)

        model.$pendingServiceActions
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                Task { @MainActor in
                    self?.restartPolling()
                }
            }
            .store(in: &cancellables)
    }

    private func updateStatusItem() {
        guard let button = statusItem?.button else {
            return
        }

        button.title = model.menuTitle
        button.image = NSImage(
            systemSymbolName: model.menuSystemImage,
            accessibilityDescription: "Zapper"
        )
        button.image?.isTemplate = true
        button.toolTip = "Zapper"
    }

    @objc private func togglePopover(_ sender: NSStatusBarButton) {
        if popover.isShown {
            popover.performClose(sender)
            return
        }

        popover.show(relativeTo: sender.bounds, of: sender, preferredEdge: .minY)
        recentlyOpenedUntil = Date().addingTimeInterval(6)
        restartPolling()
        Task {
            await model.refresh()
        }
    }

    private func restartPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            await self?.runPollingLoop()
        }
    }

    private func runPollingLoop() async {
        while !Task.isCancelled {
            let interval = currentPollingInterval()
            guard interval > 0 else {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                continue
            }

            try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            if Task.isCancelled {
                return
            }

            await model.refresh()
        }
    }

    private func currentPollingInterval() -> TimeInterval {
        if model.hasStaleServiceState {
            return 1.0 / 3.0
        }

        guard popover.isShown else {
            return 8
        }

        if Date() < recentlyOpenedUntil {
            return 1
        }

        return 3
    }
}
