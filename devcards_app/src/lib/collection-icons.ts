// Curated subset of the `devicon` package (self-hosted, no external CDN —
// same reasoning as Fontsource-hosted fonts) for tagging a collection with a
// technology. Devicon ships ~150 logos; picking a fixed, useful-for-study-
// material subset here rather than exposing all of them keeps the picker a
// scannable grid instead of a search box. Plain per-icon imports (not an
// import.meta.glob over node_modules) since the list is fixed, not dynamic.
import javascript from 'devicon/icons/javascript/javascript-original.svg';
import typescript from 'devicon/icons/typescript/typescript-original.svg';
import python from 'devicon/icons/python/python-original.svg';
import rust from 'devicon/icons/rust/rust-original.svg';
import go from 'devicon/icons/go/go-original.svg';
import java from 'devicon/icons/java/java-original.svg';
import csharp from 'devicon/icons/csharp/csharp-original.svg';
import cplusplus from 'devicon/icons/cplusplus/cplusplus-original.svg';
import php from 'devicon/icons/php/php-original.svg';
import ruby from 'devicon/icons/ruby/ruby-original.svg';
import swift from 'devicon/icons/swift/swift-original.svg';
import kotlin from 'devicon/icons/kotlin/kotlin-original.svg';
import html5 from 'devicon/icons/html5/html5-original.svg';
import css3 from 'devicon/icons/css3/css3-original.svg';
import react from 'devicon/icons/react/react-original.svg';
import svelte from 'devicon/icons/svelte/svelte-original.svg';
import vuejs from 'devicon/icons/vuejs/vuejs-original.svg';
import angularjs from 'devicon/icons/angularjs/angularjs-original.svg';
import nodejs from 'devicon/icons/nodejs/nodejs-original.svg';
import graphql from 'devicon/icons/graphql/graphql-plain.svg';
import docker from 'devicon/icons/docker/docker-original.svg';
import kubernetes from 'devicon/icons/kubernetes/kubernetes-original.svg';
import postgresql from 'devicon/icons/postgresql/postgresql-original.svg';
import mongodb from 'devicon/icons/mongodb/mongodb-original.svg';
import mysql from 'devicon/icons/mysql/mysql-original.svg';
import redis from 'devicon/icons/redis/redis-original.svg';
import git from 'devicon/icons/git/git-original.svg';
import linux from 'devicon/icons/linux/linux-original.svg';
import tailwindcss from 'devicon/icons/tailwindcss/tailwindcss-original.svg';

export const COLLECTION_ICONS = [
	'javascript',
	'typescript',
	'python',
	'rust',
	'go',
	'java',
	'csharp',
	'cplusplus',
	'php',
	'ruby',
	'swift',
	'kotlin',
	'html5',
	'css3',
	'react',
	'svelte',
	'vuejs',
	'angularjs',
	'nodejs',
	'graphql',
	'docker',
	'kubernetes',
	'postgresql',
	'mongodb',
	'mysql',
	'redis',
	'git',
	'linux',
	'tailwindcss'
] as const;
export type CollectionIcon = (typeof COLLECTION_ICONS)[number];

export function isCollectionIcon(value: unknown): value is CollectionIcon {
	return typeof value === 'string' && (COLLECTION_ICONS as readonly string[]).includes(value);
}

export const COLLECTION_ICON_META: Record<CollectionIcon, { label: string; src: string }> = {
	javascript: { label: 'JavaScript', src: javascript },
	typescript: { label: 'TypeScript', src: typescript },
	python: { label: 'Python', src: python },
	rust: { label: 'Rust', src: rust },
	go: { label: 'Go', src: go },
	java: { label: 'Java', src: java },
	csharp: { label: 'C#', src: csharp },
	cplusplus: { label: 'C++', src: cplusplus },
	php: { label: 'PHP', src: php },
	ruby: { label: 'Ruby', src: ruby },
	swift: { label: 'Swift', src: swift },
	kotlin: { label: 'Kotlin', src: kotlin },
	html5: { label: 'HTML', src: html5 },
	css3: { label: 'CSS', src: css3 },
	react: { label: 'React', src: react },
	svelte: { label: 'Svelte', src: svelte },
	vuejs: { label: 'Vue', src: vuejs },
	angularjs: { label: 'Angular', src: angularjs },
	nodejs: { label: 'Node.js', src: nodejs },
	graphql: { label: 'GraphQL', src: graphql },
	docker: { label: 'Docker', src: docker },
	kubernetes: { label: 'Kubernetes', src: kubernetes },
	postgresql: { label: 'PostgreSQL', src: postgresql },
	mongodb: { label: 'MongoDB', src: mongodb },
	mysql: { label: 'MySQL', src: mysql },
	redis: { label: 'Redis', src: redis },
	git: { label: 'Git', src: git },
	linux: { label: 'Linux', src: linux },
	tailwindcss: { label: 'Tailwind CSS', src: tailwindcss }
};
