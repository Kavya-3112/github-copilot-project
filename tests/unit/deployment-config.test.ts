import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import { afterAll, describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const buildDirectories: string[] = [];

afterAll(async () => {
  await Promise.all(
    buildDirectories.map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("static deployment output", () => {
  it("emits provider headers and assets for root and subpath builds", async () => {
    const configuredHeaders = await readFile(
      path.join(projectRoot, "public", "_headers"),
      "utf8",
    );
    const contentSecurityPolicy = configuredHeaders
      .split("\n")
      .find((line) => line.trimStart().startsWith("Content-Security-Policy:"));

    expect(configuredHeaders).toContain("X-Content-Type-Options: nosniff");
    expect(configuredHeaders).toContain(
      "Strict-Transport-Security: max-age=31536000",
    );
    expect(contentSecurityPolicy).toContain("script-src 'self'");
    expect(contentSecurityPolicy).toContain("style-src 'self'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);

    for (const base of ["/", "/contacts/"]) {
      const outputDirectory = await mkdtemp(
        path.join(tmpdir(), "contact-pages-build-"),
      );
      buildDirectories.push(outputDirectory);

      await build({
        configFile: path.join(projectRoot, "vite.config.ts"),
        root: projectRoot,
        base,
        build: {
          emptyOutDir: true,
          outDir: outputDirectory,
        },
      });

      const html = await readFile(
        path.join(outputDirectory, "index.html"),
        "utf8",
      );
      const emittedHeaders = await readFile(
        path.join(outputDirectory, "_headers"),
        "utf8",
      );
      const assets = await readdir(path.join(outputDirectory, "assets"));

      expect(html).toContain(`${base}assets/`);
      expect(emittedHeaders).toBe(configuredHeaders);
      expect(assets.some((asset) => asset.endsWith(".js"))).toBe(true);
      expect(assets.some((asset) => asset.endsWith(".css"))).toBe(true);
    }
  }, 120_000);
});