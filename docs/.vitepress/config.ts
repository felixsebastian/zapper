import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Zapper",
  description: "A lightweight dev environment runner for local multi-service projects",
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: [
    "development.md",
    "releases.md",
    "orphaned-processes.md",
    "tech-debt.md",
  ],
  themeConfig: {
    logoLink: {
      link: "https://zapper.mp-lb.dev",
      target: "_self",
    },
    nav: [
      { text: "Quick Start", link: "/" },
      { text: "Reference", link: "/usage" },
      { text: "Raw", link: "/llms-full.txt" },
    ],
    sidebar: [
      {
        text: "Using Zapper",
        items: [
          { text: "Quick Start", link: "/" },
          { text: "Reference", link: "/usage" },
          { text: "Instances", link: "/instances" },
          { text: "Resource Management", link: "/resource-management" },
          { text: "Environment Variables", link: "/env-var-mgmt" },
        ],
      },
    ],
    search: {
      provider: "local",
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/mp-lb/zapper",
      },
    ],
  },
});
