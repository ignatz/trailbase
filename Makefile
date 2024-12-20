default: format check

target/x86_64-unknown-linux-gnu/release/trail:
	RUSTFLAGS="-C target-feature=+crt-static" cargo build --target x86_64-unknown-linux-gnu --release --bin trail

format:
	pnpm -r format; \
		cargo +nightly fmt; \
		dart format client/trailbase-dart/ examples/blog/flutter/; \
		txtpbfmt `find . -regex ".*.textproto"`; \
		dotnet format client/trailbase-dotnet

check:
	pnpm -r check; \
		cargo clippy --workspace --no-deps; \
		dart analyze client/trailbase-dart examples/blog/flutter; \
		dotnet format client/trailbase-dotnet --verify-no-changes

docker:
	docker build . -t trailbase/trailbase

.PHONY: default format check
