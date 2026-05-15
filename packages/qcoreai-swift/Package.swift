// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "QCoreAI",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
        .tvOS(.v15),
        .watchOS(.v8)
    ],
    products: [
        .library(
            name: "QCoreAI",
            targets: ["QCoreAI"]
        )
    ],
    targets: [
        .target(
            name: "QCoreAI",
            path: "Sources/QCoreAI"
        ),
        .testTarget(
            name: "QCoreAITests",
            dependencies: ["QCoreAI"],
            path: "Tests/QCoreAITests"
        )
    ]
)
