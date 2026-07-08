import { default_manifest } from "../core/default_manifest";
import { ResumeStore } from "./ResumeStore";

describe("ResumeStore", () => {
	it("maintains wd paths for loaded resume nodes", () => {
		const store = new ResumeStore();
		const snapshot = JSON.parse(JSON.stringify(default_manifest));
		delete snapshot.wd;
		delete snapshot.tree.wd;
		delete snapshot.tree.root.wd;
		delete snapshot.tree.root.children[0].wd;

		store.loadSnapshot(snapshot);

		expect(store.resume.wd).toBe("/");
		expect(store.resume.tree.wd).toBe("/tree");
		expect(store.resume.tree.root.wd).toBe("/tree/root");
		expect(store.resume.tree.root.children?.[0].wd).toBe(
			"/tree/root/children/0",
		);
	});
});
