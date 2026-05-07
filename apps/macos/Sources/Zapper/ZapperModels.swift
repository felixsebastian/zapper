import Foundation

struct SystemProjectsResponse: Decodable {
    let kind: String?
    let projects: [ZapperProject]
}

struct ZapperHomeResponse: Decodable {
    let value: String
}

struct ZapperProjectLink: Decodable, Identifiable {
    let name: String
    let url: String
    let isHomepage: Bool

    var id: String { "\(name):\(url)" }
}

struct ZapperProject: Decodable, Identifiable {
    let registryId: String
    let project: String
    let projectRoot: String
    let configPath: String
    let state: String
    let lastSeenAt: String
    let lastCommand: String?
    let instances: [ZapperInstance]
    let error: String?

    var id: String { registryId }

    var counts: ServiceCounts {
        instances.reduce(.empty) { partial, instance in
            partial + instance.counts
        }
    }
}

struct ZapperInstance: Decodable, Identifiable {
    let instanceKey: String
    let instanceId: String
    let list: ZapperServiceList?
    let error: String?

    var id: String { "\(instanceKey):\(instanceId)" }

    var services: [ZapperService] {
        list?.services ?? []
    }

    var counts: ServiceCounts {
        services.reduce(.empty) { partial, service in
            partial + ServiceCounts(service: service)
        }
    }
}

struct ZapperServiceList: Decodable {
    let services: [ZapperService]
}

struct ZapperService: Decodable, Identifiable {
    let type: String
    let service: String
    let status: String
    let enabled: Bool
    let ports: [String]
    let volumes: [String]
    let cwd: String?
    let cmd: String

    var id: String { "\(type):\(service)" }

    enum CodingKeys: String, CodingKey {
        case type
        case service
        case status
        case enabled
        case ports
        case volumes
        case cwd
        case cmd
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        service = try container.decode(String.self, forKey: .service)
        status = try container.decode(String.self, forKey: .status)
        enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
        ports = try container.decode([String].self, forKey: .ports)
        volumes = try container.decode([String].self, forKey: .volumes)
        cwd = try container.decodeIfPresent(String.self, forKey: .cwd)
        cmd = try container.decode(String.self, forKey: .cmd)
    }
}

struct ServiceCounts: Equatable {
    var up: Int
    var pending: Int
    var down: Int
    var disabled: Int

    static let empty = ServiceCounts(up: 0, pending: 0, down: 0, disabled: 0)

    init(up: Int, pending: Int, down: Int, disabled: Int) {
        self.up = up
        self.pending = pending
        self.down = down
        self.disabled = disabled
    }

    init(service: ZapperService) {
        self.init(status: service.status, enabled: service.enabled)
    }

    init(status: String, enabled: Bool) {
        guard enabled else {
            self.init(up: 0, pending: 0, down: 0, disabled: 1)
            return
        }

        switch status {
        case "up":
            self.init(up: 1, pending: 0, down: 0, disabled: 0)
        case "pending":
            self.init(up: 0, pending: 1, down: 0, disabled: 0)
        default:
            self.init(up: 0, pending: 0, down: 1, disabled: 0)
        }
    }

    init(status: String) {
        switch status {
        case "up":
            self.init(up: 1, pending: 0, down: 0, disabled: 0)
        case "pending":
            self.init(up: 0, pending: 1, down: 0, disabled: 0)
        default:
            self.init(up: 0, pending: 0, down: 1, disabled: 0)
        }
    }

    var total: Int { up + pending + down }
    var totalIncludingDisabled: Int { total + disabled }
}

func + (lhs: ServiceCounts, rhs: ServiceCounts) -> ServiceCounts {
    ServiceCounts(
        up: lhs.up + rhs.up,
        pending: lhs.pending + rhs.pending,
        down: lhs.down + rhs.down,
        disabled: lhs.disabled + rhs.disabled
    )
}
