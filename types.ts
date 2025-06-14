export type Record = {
    _id: string;
    name: string;
    target: string;
    searchable: boolean;
    created_at: Date;
    updated_at: Date;
}
export type Domain = {
    _id: string;
    tld: string;
    name: string;
    target: string;
    secret: string;
    records: Record[];
    created_at: Date;
    updated_at: Date;
    resolved_at: Date;
    owned_by: {
        registrar: string;
        user: string;
    };
    adopted: boolean;
    suspended: boolean;
    searchable: boolean;
    note: string;
}

export type TLD = {
    real: string[];
    webx: string[];
    webx_plus: string[];
    reserved: string[];
}