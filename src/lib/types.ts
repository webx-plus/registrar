export interface Domain {
	_id: string;
	name: string;
	tld: string;
	target?: string;
	owned_by: {
		registrar: string;
		user: string;
		history: string[];
	};
	records: DomainRecord[];
	created_at: string;
	updated_at: string;
	resolved_at: string;
	deleted_at?: string;
	request_deleted_at?: string;
	pending_deletion: boolean;
	adopted: boolean;
	suspended: boolean;
	searchable: boolean;
	note?: string;

    clerk_user?: { username: string, imageUrl: string | null };
}

export interface DomainRecord {
	_id: string;
	name: string;
	type: RecordType;
	value: string;
}

export interface Registrar {
	_id: string;
	created_at: Date;
	deleted_at?: Date | null;
	request_deleted_at?: Date;
	pending_deletion?: boolean | null;
	name: string;
	reserved_tlds: string[];
	suspended: boolean;
	official: boolean;
	website_url?: string | null;
	api_key?: string | null;

	__v?: number;
}

export interface UserTLD {
	userId: string;
	tlds: string[];
}

export enum RecordType {
    RED = "RED",
    WEB = "WEB",
    TXT = "TXT",
}