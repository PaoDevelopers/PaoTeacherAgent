package deployfiles

import (
	"io/fs"
	"testing"
)

// TestManifestCoversEmbeddedFS ensures every file in the embedded FS has a
// manifest entry (and vice versa), so nothing ships unmanaged.
func TestManifestCoversEmbeddedFS(t *testing.T) {
	manifest := make(map[string]bool, len(All))
	for _, f := range All {
		manifest[f.EmbedPath] = true
	}

	var embeddedPaths []string
	err := fs.WalkDir(embeddedFS, "embedded", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			embeddedPaths = append(embeddedPaths, path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("failed to walk embedded FS: %v", err)
	}

	for _, path := range embeddedPaths {
		if !manifest[path] {
			t.Errorf("embedded file %s has no entry in deployfiles.All", path)
		}
	}
	if len(embeddedPaths) != len(All) {
		t.Errorf("embedded FS has %d files but deployfiles.All lists %d", len(embeddedPaths), len(All))
	}
}

// TestManifestInvariants checks each entry is internally consistent.
func TestManifestInvariants(t *testing.T) {
	for _, f := range All {
		if f.Mode == 0 {
			t.Errorf("%s: zero Mode", f.EmbedPath)
		}
		if f.DestRel == "" || f.RepoPath == "" {
			t.Errorf("%s: missing DestRel or RepoPath", f.EmbedPath)
		}
	}
	if NginxRunScript.Mode != 0755 {
		t.Errorf("run-nginx.sh must stay executable (got mode %o)", NginxRunScript.Mode)
	}
}
