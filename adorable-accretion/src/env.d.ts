/// <reference path="../.astro/types.d.ts" />

declare namespace App {
	interface Locals {
		user?: {
			username: string;
			role: string;
		};
	}
}
