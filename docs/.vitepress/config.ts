import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Zapper",
  description: "A lightweight dev environment runner for local multi-service projects",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Quick Start", link: "/" },
      { text: "Reference", link: "/usage" },
      { text: "Development", link: "/development" },
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
      {
        text: "Maintaining Zapper",
        items: [
          { text: "Development", link: "/development" },
          { text: "Releases", link: "/releases" },
          { text: "Orphaned Process Diagnostics", link: "/orphaned-processes" },
          { text: "Tech Debt", link: "/tech-debt" },
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
