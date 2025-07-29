import type { Domain, Registrar, DomainRecord, RecordType } from "@/lib/types";

const DNS_API_URL = import.meta.env.DNS_API_URL;
const DNS_API_VERSION = import.meta.env.DNS_API_VERSION;
const DNS_REGISTRAR_TOKEN = import.meta.env.DNS_REGISTRAR_TOKEN;

async function sendDNSRequest(url: string, method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE", data?: any, userId?: string) {
	const request = await fetch(`${DNS_API_URL}/${DNS_API_VERSION}/${url}`, {
		method: method,
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Registrar ${DNS_REGISTRAR_TOKEN}`,
			"X-WXP-Internal": "true",
			...(userId ? { "X-Requesting-User": userId } : {}),
		},
		body: method === "GET" ? undefined : JSON.stringify(data),
	});

	const result = await request.json().catch((e) => {
		console.error(e);
		return { status: 500, error: e };
	});

	if (request.status === 500) {
		console.error(`DNS Request Failed: ${method} ${url}`, result.error ?? result.data);
	}

	return { status: request.status, data: result.data, error: result.error ?? null };
}

function generateSecret() {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateApiKey(id: string) {
	return `${btoa(id).replaceAll(/=/g, "")}.${generateSecret()}${generateSecret()}${generateSecret()}${generateSecret()}`;
}

type domainQueryParams = {
	owned?: boolean;
	search?: string;
	page?: number;
	limit?: number;
}

type DomainCreateParams = {
	name: string;
	tld: string;
	target: string;
	note?: string;
	searchable?: boolean;
}

type TLDResponse = {
	valid: string[];
	available: string[];
	info: {
		[tld: string]: {
			reserved: boolean;
		}
	}
}

export class APIClient {
	async getDomains(params?: domainQueryParams, userId?: string): Promise<Domain[]> {
		const searchParams = new URLSearchParams();
		if (params?.owned) searchParams.set("owned", "true");
		if (params?.search) searchParams.set("search", params.search);
		if (params?.page) searchParams.set("page", params.page.toString());
		if (params?.limit) searchParams.set("limit", params.limit.toString());

		const response = await sendDNSRequest(`domains${searchParams.toString() ? `?${searchParams}` : ""}`, "GET", {}, userId);

		if (response.status !== 200) {
			throw new Error(response.error || `HTTP ${response.status}`);
		}
		return response.data;
	};

	async getDomain(domainId: string, userId: string): Promise<Domain> {
		const response = await sendDNSRequest(`domains/${domainId}`, "GET", {}, userId);
		if (response.status !== 200) {
			throw new Error(response.error || `HTTP ${response.status}`);
		}
		return response.data;
	};

	async createDomain(data: DomainCreateParams, userId: string): Promise<Domain & { secret?: string }> {
		const response = await sendDNSRequest(`domains/${data.name}.${data.tld}`, "PUT", data, userId);
		if (response.status !== 200) {
			throw new Error(response.error || `HTTP ${response.status}`);
		}
		return response.data;
	};

	async updateDomain(domainId: string, data: Partial<Domain>, userId: string): Promise<Domain> {
		const response = await sendDNSRequest(`domains/${domainId}`, "PATCH", data, userId);
		if (response.status !== 200) {
			throw new Error(response.error || `HTTP ${response.status}`);
		}
		return response.data;
	};

	async deleteDomain(domainId: string, userId: string): Promise<void> {
		const response = await sendDNSRequest(`domains/${domainId}`, "DELETE", {}, userId);
		if (response.status !== 200) {
			throw new Error(response.error || `HTTP ${response.status}`);
		}
	};

	async transferDomain(domainId: string, newOwnerId: string, userId: string): Promise<Domain> {
		const response = await sendDNSRequest(`domains/${domainId}/transfer`, "PATCH", { user: newOwnerId }, userId);
		if (response.status !== 200) {
			throw new Error(response.error || `HTTP ${response.status}`);
		}
		return response.data;
	};

	async restoreDomain(domainId: string, userId: string): Promise<Domain> {
		const response = await sendDNSRequest(`domains/${domainId}/restore`, "POST", {}, userId);
		if (response.status !== 200) {
			throw new Error(response.error || `HTTP ${response.status}`);
		}
		return response.data;
	};

	async getTLDs(): Promise<TLDResponse> {
		const response = await sendDNSRequest("tlds", "GET");
		if (response.status !== 200) {
			throw new Error(response.error || `HTTP ${response.status}`);
		}
		return response.data;
	};

	async createRecord(domainId: string, data: {type: RecordType, name: string, value: string}, userId: string): Promise<Domain> {
		const response = await sendDNSRequest(`domains/${domainId}/records`, "PUT", data, userId);
		if (response.status !== 200) {
			throw new Error(response.error || `HTTP ${response.status}`);
		}
		return response.data;
	};

	async updateRecord(domainId: string, recordId: string, data: {type?: RecordType, value?: string}, userId: string): Promise<Domain> {
		const response = await sendDNSRequest(`domains/${domainId}/records/${recordId}`, "PATCH", data, userId);
		if (response.status !== 200) {
			throw new Error(response.error || `HTTP ${response.status}`);
		}
		return response.data;
	};

	async deleteRecord(domainId: string, recordId: string, userId: string): Promise<Domain> {
		const response = await sendDNSRequest(`domains/${domainId}/records/${recordId}`, "DELETE", {}, userId);
		if (response.status !== 200) {
			throw new Error(response.error || `HTTP ${response.status}`);
		}
		return response.data;
	};
}

const api = new APIClient();

export default api;