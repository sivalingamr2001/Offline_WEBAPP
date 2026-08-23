export interface PortalSection {
  key: string;
  label: string;
  icon: string;
  route: string;
  tableName: string;
  syncTableId: string;
  order: number;
}

export interface PortalManifest {
  portalId: string;
  title: string;
  sections: PortalSection[];
}
