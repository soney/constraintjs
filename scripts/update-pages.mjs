// Updates a checkout of the gh-pages branch (the website, https://cjs.from.so/) for the
// current version:
//
// - adds builds/constraintjs-<version>/ (cjs.js and cjs.min.js, with source maps) and a .zip of it,
// - copies the same files to builds/constraintjs-latest/, which the home page's examples use,
// - replaces api/ with the TypeDoc output in docs/, and
// - points the home page's download button at the new version.
//
// Usage: npm run pages -- <path to a gh-pages checkout>
// (`npm run pages` builds dist/ and docs/ first.) Review the changes, then commit and push the checkout.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const site = process.argv[2];
if (!site || !existsSync(join(site, "index.html")) || !existsSync(join(site, "builds"))) {
	console.error("Usage: npm run pages -- <path to a checkout of the gh-pages branch>");
	process.exit(1);
}
const root = join(import.meta.dirname, "..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const name = `constraintjs-${version}`;

// The <script> bundles, renamed to the file names that the site has always used
const files = {};
for (const suffix of ["", ".min"]) {
	const from = `constraintjs.global${suffix}.js`;
	const to = `cjs${suffix}.js`;
	const code = readFileSync(join(root, "dist", from), "utf8");
	const mapComment = `//# sourceMappingURL=${from}.map`;
	if (!code.includes(mapComment)) throw new Error(`dist/${from} doesn't end with "${mapComment}"`);
	const map = JSON.parse(readFileSync(join(root, "dist", `${from}.map`), "utf8"));
	files[to] = code.replace(mapComment, `//# sourceMappingURL=${to}.map`);
	files[`${to}.map`] = JSON.stringify({ ...map, file: to });
}
for (const directory of [name, "constraintjs-latest"]) {
	const path = join(site, "builds", directory);
	rmSync(path, { recursive: true, force: true });
	mkdirSync(path);
	for (const [file, contents] of Object.entries(files)) writeFileSync(join(path, file), contents);
}
// Like earlier releases, the .zip holds a constraintjs-<version>/ directory
rmSync(join(site, "builds", `${name}.zip`), { force: true });
execFileSync("zip", ["-q", "-r", "-X", `${name}.zip`, name], { cwd: join(site, "builds"), stdio: "inherit" });

// The API reference. The old one was a single page with anchors like #cjs_bindText and
// #cjs_Constraint_prototype_get, so links to those are sent to the matching TypeDoc page.
const api = join(site, "api");
rmSync(api, { recursive: true, force: true });
cpSync(join(root, "docs"), api, { recursive: true, filter: (path) => basename(path) !== ".nojekyll" });
const redirect = `<script>
(function () {
	var classes = ["ArrayConstraint", "Binding", "CJSEvent", "Constraint", "FSM", "MapConstraint"];
	var templateSections = ["basics", "constraints", "literals", "comments", "constraint-output", "block-helpers",
		"loops", "conditions", "state", "with-helper", "partials"];
	var hash = location.hash.slice(1).replace(/\\./g, "_");
	var target;
	if (hash === "cjs") target = "interfaces/ConstraintJS.html";
	else if (templateSections.indexOf(hash) >= 0) target = "interfaces/ConstraintJS.html#createtemplate";
	else if (hash.indexOf("cjs_") === 0) {
		var rest = hash.slice(4); // "bindText", "Constraint", "Constraint_prototype_get", "ArrayConstraint_BREAK"...
		var className = rest.split("_")[0];
		if (classes.indexOf(className) >= 0) {
			var member = rest.slice(className.length).replace(/^_(prototype_)?/, "");
			target = "classes/" + className + ".html" + (member ? "#" + member.toLowerCase() : "");
		} else target = "interfaces/ConstraintJS.html#" + rest.toLowerCase();
	}
	if (!target) return;
	// Hide this page, and leave once it has been parsed (TypeDoc's scripts expect it to have a <body>)
	document.documentElement.style.visibility = "hidden";
	document.addEventListener("DOMContentLoaded", function () {
		location.replace(target);
	});
})();
</script>`;
const apiIndex = join(api, "index.html");
const apiHtml = readFileSync(apiIndex, "utf8");
if (!apiHtml.includes("</head>")) throw new Error("docs/index.html has no </head>");
writeFileSync(apiIndex, apiHtml.replace("</head>", `${redirect}</head>`));

// The home page's download button
const home = join(site, "index.html");
const html = readFileSync(home, "utf8");
const zipLink = /builds\/constraintjs-[\w.-]+\.zip/;
const versionLabel = /<span class="version">[^<]*<\/span>/;
if (!zipLink.test(html) || !versionLabel.test(html)) {
	throw new Error("index.html doesn't have the expected download button; update it by hand");
}
writeFileSync(
	home,
	html.replace(zipLink, `builds/${name}.zip`).replace(versionLabel, `<span class="version">v${version}</span>`),
);

console.log(`Updated ${site} for v${version}. Review the changes, then commit and push the gh-pages branch.`);
