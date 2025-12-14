#!/bin/bash
set -e

echo "🧹 Git Repository Cleanup - Removing Large Soundfonts"
echo "====================================================="
echo ""
echo "⚠️  WARNING: This will rewrite Git history!"
echo "   All commits will get new hashes."
echo "   If you've already pushed, you'll need to force push."
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "📋 Creating backup..."
git branch backup-before-cleanup 2>/dev/null || echo "Backup branch already exists"

echo ""
echo "🔍 Files to remove from history:"
echo "  - FluidR3_GM_GS.sf2 (151 MB)"
echo "  - alex_gm.sf2 (481 MB)"
echo ""

echo "🗑️  Removing files from Git history..."

# Method 1: Using git filter-repo (recommended if installed)
if command -v git-filter-repo &> /dev/null; then
    echo "Using git-filter-repo..."
    git filter-repo --invert-paths \
        --path FluidR3_GM_GS.sf2 \
        --path alex_gm.sf2 \
        --force
else
    # Method 2: Using git filter-branch (fallback)
    echo "Using git filter-branch (fallback)..."
    git filter-branch --force --index-filter \
        'git rm --cached --ignore-unmatch FluidR3_GM_GS.sf2 alex_gm.sf2' \
        --prune-empty --tag-name-filter cat -- --all
    
    # Cleanup refs
    rm -rf .git/refs/original/
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Repository size:"
du -sh .git
echo ""
echo "🚀 Next steps:"
echo "1. Verify files are gone: git log --all -- '*.sf2'"
echo "2. Force push to remote: git push --force-with-lease origin main"
echo "3. If needed, restore from backup: git reset --hard backup-before-cleanup"
echo ""
