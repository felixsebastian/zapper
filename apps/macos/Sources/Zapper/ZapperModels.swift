import Foundation

struct SystemProjectsResponse: Decodable {
    let kind: String?
    let projects: [ZapperProject]
}

struct ZapperHomeResponse: Decodable {
    let value: String
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
            partial + ServiceCounts(status: service.status)
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
    let ports: [String]
    let volumes: [String]
    let cwd: String?
    let cmd: String

    var id: String { "\(type):\(service)" }
}

struct ServiceCounts: Equatable {
    var up: Int
    var pending: Int
    var down: Int

    static let empty = ServiceCounts(up: 0, pending: 0, down: 0)

    init(up: Int, pending: Int, down: Int) {
        self.up = up
        self.pending = pending
        self.down = down
    }

    init(status: String) {
        switch status {
        case "up":
            self.init(up: 1, pending: 0, down: 0)
        case "pending":
            self.init(up: 0, pending: 1, down: 0)
        default:
            self.init(up: 0, pending: 0, down: 1)
        }
    }

    var total: Int { up + pending + down }
}

func + (lhs: ServiceCounts, rhs: ServiceCounts) -> ServiceCounts {
    ServiceCounts(
        up: lhs.up + rhs.up,
        pending: lhs.pending + rhs.pending,
        down: lhs.down + rhs.down
    )
}
