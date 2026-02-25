const pkg = require("../package.json");

const pkgTag = `v${pkg.version}`;
const refName = process.env.GITHUB_REF_NAME || process.env.EXPECTED_TAG || "";

if (!refName) {
  console.log(`[release:verify-tag] No tag input provided. Expected: ${pkgTag}`);
  process.exit(0);
}

if (refName !== pkgTag) {
  console.error(`[release:verify-tag] Tag mismatch: git tag=${refName}, package.json=${pkgTag}`);
  process.exit(1);
}

console.log(`[release:verify-tag] OK (${pkgTag})`);
