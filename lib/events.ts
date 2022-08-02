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

import {
	EventHandler,
	github,
	repository,
	status,
	subscription,
} from "@atomist/skill";

import { Configuration } from "./configuration";

export const on_push: EventHandler<
	[subscription.datalog.OnPush],
	Configuration
> = async ctx => {
	const commit = ctx.event.context.subscription.result[0][0];
	const repo = commit["git.commit/repo"];
	const org = repo["git.repo/org"];
	const branch = commit["git.ref/refs"].find(
		r => r["git.ref/type"]["db/ident"] === "git.ref.type/branch",
	)?.["git.ref/name"];

	if (!branch || branch.startsWith("atomist/")) {
		return status.completed(`Ignoring missing or atomist branch`);
	}

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

	// go mod tidy
	await p.exec("go", ["mod", "tidy"]);
	// gofmt -w *.go
	await p.exec("gofmt", ["-w", "."]);
	// goimports -w *.go
	await p.exec("goimports", ["-w", "."]);

	return github.persistChanges(
		ctx,
		p,
		"pr",
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
			body: "Go format fixed warnings and/or errors",
		},
		{
			message: "Fixes from gofmt and goimports",
		},
	);
};
