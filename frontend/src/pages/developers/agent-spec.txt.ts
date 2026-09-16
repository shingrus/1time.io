import type {APIRoute} from 'astro';
import agentSpec from '../../lib/agent-spec.md?raw';

export const GET: APIRoute = () => new Response(agentSpec, {
    headers: {'Content-Type': 'text/plain; charset=utf-8'},
});
