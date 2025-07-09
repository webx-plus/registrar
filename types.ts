export type Record = {
    _id: string;
    type: "WEB" | "TXT" | "RED";
    name: string;
    value: string;
}
export type Domain = {
    _id: string;
    created_at: Date;
    updated_at: Date;
    resolved_at?: Date;
    owned_by: {
        registrar: string;
        user: string;
    };

    suspended: boolean;
    searchable: boolean;

    name: string;
    tld: string;
    records: Record[];

    note?: string;
}