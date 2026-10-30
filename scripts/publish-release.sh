#!/usr/bin/env bash
set -euo pipefail
image=ghcr.io/mick7784/links-pulse
version=$(node -p "require('./package.json').version")
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
# All main releases share the workflow concurrency group; refuse stale retries.
fresh() {
  test "$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq .object.sha)" = "$GITHUB_SHA"
  gh api "repos/$GITHUB_REPOSITORY/releases" > releases.json
  VERSION="$version" node --input-type=module -e '
    import fs from "node:fs";
    const current=process.env.VERSION.split(".").map(Number);
    for(const r of JSON.parse(fs.readFileSync("releases.json"))){
      if(r.draft||r.prerelease||!/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(r.tag_name))continue;
      const v=r.tag_name.slice(1).split(".").map(Number);
      for(let i=0;i<3;i++){if(v[i]>current[i])process.exit(1);if(v[i]<current[i])break;}
    }'
  rm releases.json
}
fresh
# A registry failure is NOT evidence that an immutable tag is absent.
token=$(curl --fail --silent --show-error -u "$GITHUB_ACTOR:$GH_TOKEN" "https://ghcr.io/token?service=ghcr.io&scope=repository:mick7784/links-pulse:pull" | jq -er .token)
code=$(curl --silent --show-error -o /tmp/pulse-manifest.json -w '%{http_code}' -H "Authorization: Bearer $token" -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json' "https://ghcr.io/v2/mick7784/links-pulse/manifests/$version")
unset token
case "$code" in
  404)
    # A released/tagged version must never be rebuilt, even if registry content disappeared.
    gh api "repos/$GITHUB_REPOSITORY/tags" > /tmp/pulse-tags.json
    VERSION="$version" node -e 'if(require("/tmp/pulse-tags.json").some(t=>t.name==="v"+process.env.VERSION))process.exit(1)'
    docker buildx build --platform linux/amd64,linux/arm64 --label "org.opencontainers.image.revision=$GITHUB_SHA" --label "org.opencontainers.image.version=$version" --label "org.opencontainers.image.source=https://github.com/Mick7784/PulSe" --tag "$image:$version" --push . ;;
  200) echo 'Existing numbered image: verify and reuse, never overwrite.' ;;
  *) echo "Registry returned $code; refusing publication"; exit 1 ;;
esac
digest=$(docker buildx imagetools inspect "$image:$version" --format '{{.Manifest.Digest}}')
docker buildx imagetools inspect --raw "$image@$digest" > /tmp/pulse-release-manifest.json
for arch in amd64 arm64; do
  child=$(jq -er --arg arch "$arch" '.manifests[] | select(.platform.os=="linux" and .platform.architecture==$arch) | .digest' /tmp/pulse-release-manifest.json)
  docker pull --platform "linux/$arch" "$image@$child"
  test "$(docker image inspect "$image@$child" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" = "$GITHUB_SHA"
  test "$(docker image inspect "$image@$child" --format '{{index .Config.Labels "org.opencontainers.image.version"}}')" = "$version"
done
fresh
docker buildx imagetools create --tag "$image:latest" "$image@$digest"
test "$digest" = "$(docker buildx imagetools inspect "$image:latest" --format '{{.Manifest.Digest}}')"
if ! gh release view "v$version" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  gh release create "v$version" --repo "$GITHUB_REPOSITORY" --target "$GITHUB_SHA" --title "PulSe V$version" --notes-file docs/RELEASE_NOTES.md
fi
gh release upload "v$version" /tmp/pulse-release-manifest.json --repo "$GITHUB_REPOSITORY" --clobber
printf 'Verified numbered/latest digest: %s\n' "$digest" >> "$GITHUB_STEP_SUMMARY"
cat /tmp/pulse-release-manifest.json >> "$GITHUB_STEP_SUMMARY"
