/*
 * Copyright © 2022 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventHandler, github, repository, subscription } from "@atomist/skill";

export const on_push: EventHandler<
	[subscription.datalog.OnPush]
> = async ctx => {
	const commit = ctx.event.context.subscription.result[0][0];
	const repo = commit["git.commit/repo"];
	const org = repo["git.repo/org"];
	const branch = commit["git.ref/refs"].find(
		r => r["git.ref/type"]["db/ident"] === "git.ref.type/branch",
	)?.["git.ref/name"];

	const p = await ctx.project.clone(
		repository.gitHub({
			owner: org["git.org/name"],
			repo: repo["git.repo/name"],
			//branch,
			sha: commit["git.commit/sha"],
			credential: org["github.org/installation-token"]
				? {
						token: org["github.org/installation-token"],
						scopes: [],
				  }
				: undefined,
		}),
		{ alwaysDeep: false, detachHead: false },
	);

	const runGoModTidy =
		ctx.event.context.subscription.configuration?.parameters?.find(
			p => p.name === "goModTidy",
		)?.value || false;
	const commands = [
		runGoModTidy ? "go mod tidy" : undefined,
		"gofmt -w .",
		"goimports -w .",
	];

	return github.persistChanges(
		ctx,
		p,
		"pr_default_commit",
		{
			branch,
			defaultBranch: repo["git.repo/default-branch"],
			author: {
				login: commit["git.commit/author"]["git.user/login"],
				name: commit["git.commit/author"]["git.user/name"],
				email: commit["git.commit/author"]["git.user/emails"]?.[0]?.[
					"email.email/address"
				],
			},
		},
		{
			branch: `atomist/gofmt-${branch}`,
			title: "Go format fixes",
			body: `Ran the following commands and fixed some issues:

\`\`\`
${commands
	.filter(c => !!c)
	.map(c => `$ ${c}`)
	.join("\n")}
\`\`\``,
		},
		{
			editors: [
				async () => {
					if (runGoModTidy) {
						// go mod tidy
						await p.exec("go", ["mod", "tidy"]);
						return "Run `go mod tidy`";
					}
					return undefined;
				},
				async () => {
					// gofmt -w *.go
					await p.exec("gofmt", ["-w", "."]);
					return "Run `gofmt -w .`";
				},
				async () => {
					// goimports -w *.go
					await p.exec("goimports", ["-w", "."]);
					return "Run `goimports -w .`";
				},
			],
		},
	);
};
