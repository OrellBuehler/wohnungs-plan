<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { LogIn } from 'lucide-svelte';
	import { login, isLoading } from '$lib/stores/auth.svelte';

	const loading = $derived(isLoading());
</script>

<Button variant="outline" onclick={login} disabled={loading}>
	<LogIn class="mr-2 h-4 w-4" />
	{loading ? 'Loading...' : 'Sign in'}
</Button>
