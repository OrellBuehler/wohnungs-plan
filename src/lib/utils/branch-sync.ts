export function shouldApplyUrlBranch(
	urlBranchId: string | null,
	activeBranchId: string | null,
	pendingUrlBranchId: string | null
): boolean {
	if (!urlBranchId || !activeBranchId) return false;
	if (pendingUrlBranchId && urlBranchId !== pendingUrlBranchId) return false;
	return urlBranchId !== activeBranchId;
}
