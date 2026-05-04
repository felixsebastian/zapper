import { env } from "node:process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_REPO = "mp-lb/zapper";

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  html_url: string;
  assets: GitHubReleaseAsset[];
}

function getRepo(): string {
  const repo = env.ZAPPER_GITHUB_REPO || DEFAULT_REPO;
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) ? repo : DEFAULT_REPO;
}

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "zapper-landing-page",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token =
    env.DESKTOP_RELEASES_GITHUB_TOKEN ||
    env.GITHUB_RELEASE_TOKEN ||
    env.GITHUB_TOKEN;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function findMacAsset(assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
  return (
    assets.find((asset) => {
      const name = asset.name.toLowerCase();
      return name.endsWith(".zip") && name.includes("macos");
    }) ?? null
  );
}

export async function GET() {
  const repo = getRepo();
  const releasesUrl = `https://github.com/${repo}/releases`;
  const response = await fetch(
    `https://api.github.com/repos/${repo}/releases/latest`,
    {
      headers: getGitHubHeaders(),
      next: { revalidate: 300 },
    },
  );

  if (!response.ok) {
    return NextResponse.redirect(releasesUrl, {
      status: 302,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const release = (await response.json()) as GitHubRelease;
  const asset = findMacAsset(release.assets);
  const targetUrl = asset?.browser_download_url || release.html_url;

  return NextResponse.redirect(targetUrl, {
    status: 302,
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
