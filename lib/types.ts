export type Cliente = {
  id: string;
  user_id: string;
  nombre: string;
  empresa?: string;
  email: string;
  username?: string;
  activo: boolean;
  created_at: string;
};

export type Variedad = {
  id: string;
  nombre: string;
  tipo: "color" | "rojo" | "mixto";
  color?: string;
  activo: boolean;
};

export type Coordinacion = {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  hawb?: string;
  awb?: string;
  origen?: string;
  destino?: string;
  pais?: string;
  dae?: string;
  hbs?: number;
  variedad?: string;
  fecha_salida?: string;
  fecha_estimada_miami?: string;
  fecha_confirmada_miami?: string;
  estado: "coordinado" | "en_transito" | "entregado" | "cancelado";
  qr_token?: string;
  export_id?: string;
  productos: ProductoItem[];
  cajas: CajaItem[];
  inventario_creado?: boolean;
  created_at: string;
};

export type ProductoItem = {
  nombre: string;
  cantidad: number;
  stem_length?: string;
  bunch?: string;
  stem?: string;
};

export type CajaItem = {
  caja: number;
  titulo: string;
  cantidad: string;
  stem_length?: string;
  bunch?: string;
  stem?: string;
  composicion?: string;
  productos?: unknown[];
};

export type Orden = {
  id: string;
  cliente_id: string;
  fecha_salida_finca: string;
  estado: "pendiente" | "confirmada" | "procesando" | "completada" | "cancelada";
  notas?: string;
  created_at: string;
  orden_items?: OrdenItem[];
};

export type OrdenItem = {
  id: string;
  orden_id: string;
  tipo_caja: "bouquet" | "bonche";
  categoria: "color" | "rojo";
  variedad_id?: string;
  variedad_nombre?: string;
  cantidad_cajas: number;
  stem_length?: string;
  stems_por_caja: number;
  notas?: string;
};

export type Inventario = {
  id: string;
  cliente_id: string;
  coordinacion_id?: string;
  caja_numero?: number;
  tipo_caja?: "bouquet" | "bonche";
  categoria?: "color" | "rojo";
  variedad?: string;
  cantidad_total: number;
  cantidad_vendida: number;
  estado_caja: "disponible" | "parcial" | "vendida";
  qr_token?: string;
  notas?: string;
  created_at: string;
  inventario_items?: InventarioItem[];
};

export type InventarioItem = {
  id: string;
  inventario_id: string;
  descripcion: string;
  cantidad: number;
  vendido: boolean;
  vendido_at?: string;
};

export type Venta = {
  id: string;
  cliente_id: string;
  inventario_id?: string;
  variedad: string;
  tipo_caja?: string;
  stem_length?: string;
  color?: string;
  cantidad: number;
  comprador?: string;
  notas?: string;
  fecha_venta: string;
  devuelto: boolean;
  fecha_devolucion?: string;
  pagado: boolean;
  fecha_pago?: string;
  created_at: string;
};

export type Credito = {
  id: string;
  cliente_id: string;
  inventario_id?: string;
  venta_id?: string;
  variedad: string;
  tipo_caja?: string;
  stem_length?: string;
  color?: string;
  cantidad: number;
  caja_numero?: number;
  motivo: string;
  notas?: string;
  fecha_credito: string;
  created_at: string;
};

export type Comprador = {
  id: string;
  cliente_id: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  notas?: string;
  created_at: string;
};

export type OrdenVenta = {
  id: string;
  cliente_id: string;
  comprador_id?: string;
  comprador_nombre?: string;
  estado: string;
  notas?: string;
  pagado: boolean;
  fecha_orden: string;
  created_at: string;
};

export type OrdenVentaItem = {
  id: string;
  orden_venta_id: string;
  inventario_id?: string;
  variedad: string;
  tipo_caja?: string;
  stem_length?: string;
  color?: string;
  cantidad: number;
  caja_numero?: number;
  created_at: string;
};
