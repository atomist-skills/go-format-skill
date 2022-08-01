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
	datalog,
	EventHandler,
	github,
	log,
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

	const gitCommit = (
		await github
			.api(
				repository.gitHub({
					owner: org["git.org/name"],
					repo: repo["git.repo/name"],
					credential: org["github.org/installation-token"]
						? {
								token: org["github.org/installation-token"],
								scopes: [],
						  }
						: undefined,
				}),
			)
			.repos.getCommit({
				owner: org["git.org/name"],
				repo: repo["git.repo/name"],
				ref: commit["git.commit/sha"],
			})
	).data;

	await ctx.datalog.transact([
		datalog.entity("git/repo", "$repo", {
			"sourceId": repo["git.repo/source-id"],
			"git.provider/url": org["git.provider/url"],
		}),
		datalog.entity("git/commit", "$commit", {
			"sha": commit["git.commit/sha"],
			"repo": "$repo",
			"git.provider/url": org["git.provider/url"],
		}),
		datalog.entity("git.commit/signature", {
			commit: "$commit",
			signature: gitCommit.commit.verification.signature,
			status: gitCommit.commit.verification.verified
				? datalog.asKeyword("git.commit.signature/VERIFIED")
				: datalog.asKeyword("git.commit.signature/NOT_VERIFIED"),
			reason: gitCommit.commit.verification.reason,
		}),
	]);

	log.info("Transacted commit signature for %s", commit["git.commit/sha"]);

	return status.completed(
		"Successfully transacted commit signature for 1 commit",
	);
};

interface CommitSignature {
	"git.commit.signature/signature": string;
	"git.commit.signature/reason": string;
	"git.commit.signature/status": string;
}

export const on_commit_signature: EventHandler<
	[subscription.datalog.OnPush, CommitSignature],
	Configuration
> = async ctx => {
	const result = ctx.event.context.subscription.result[0];
	const commit = result[0];
	const signature = result[1];
	log.info(
		"Commit %s is signed and verified by: %s",
		commit["git.commit/sha"],
		signature["git.commit.signature/signature"],
	);

	return status.completed("Detected signed and verified commit");
};
