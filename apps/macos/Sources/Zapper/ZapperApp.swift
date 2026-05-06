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

        Task {
            await model.refresh()
        }
    }

    private func configureStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            button.action = #selector(togglePopover(_:))
            button.target = self
            button.imagePosition = .imageLeading
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
    }

    private func updateStatusItem() {
        guard let button = statusItem?.button else {
            return
        }

        button.title = " \(model.menuTitle)"
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
        Task {
            await model.refresh()
        }
    }
}
