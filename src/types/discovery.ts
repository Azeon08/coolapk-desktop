export interface DiscoveryEntity {
  id?: string | number;
  entityId?: string | number;
  entityType?: string;
  entityTemplate?: string;
  title?: string;
  subTitle?: string;
  description?: string;
  message?: string;
  url?: string;
  webUrl?: string;
  pic?: string;
  picUrl?: string;
  pic_url?: string;
  logo?: string;
  icon?: string;
  productGoodsLogo?: string;
  product_goods_cover?: string;
  goodsCover?: string;
  goods_cover?: string;
  goodsPic?: string;
  goods_pic?: string;
  productGoodsTitle?: string;
  product_goods_title?: string;
  goodsTitle?: string;
  goods_title?: string;
  price?: string | number;
  priceText?: string;
  goodsPrice?: string | number;
  goods_price?: string | number;
  goodsPromoPrice?: string | number;
  goods_promo_price?: string | number;
  mallName?: string;
  mall_name?: string;
  mallTitle?: string;
  mall_title?: string;
  note?: string;
  uid?: string | number;
  username?: string;
  userAvatar?: string;
  avatar_plugin_url?: string;
  // 用户列表既可能平铺作者信息，也可能嵌套在 userInfo 中。
  userInfo?: { username?: string; userAvatar?: string; avatar_plugin_url?: string; [key: string]: unknown };
  dateline?: number | string;
  entities?: DiscoveryEntity[];
  extraData?: unknown;
  [key: string]: unknown;
}

export interface DiscoveryTab {
  key: string;
  title: string;
  url: string;
  webUrl?: string;
  pageName?: string;
  subTitle?: string;
  icon?: string;
  selectedIcon?: string;
  iconTint?: string;
  openNewActivity?: boolean;
  nativeKind?: 'dyh' | 'goods';
  visible: boolean;
  order: number;
  raw: DiscoveryEntity;
}

export interface DiscoveryPageResult {
  flexUrl?: string;
  items: DiscoveryEntity[];
  page: number;
  hasMore: boolean;
  firstItem: string;
  lastItem: string;
  pageContext?: string;
  raw: unknown;
}

export type DiscoveryRouteKind = 'data-list' | 'web' | 'native';

export interface DiscoveryRoute {
  kind: DiscoveryRouteKind;
  target: string;
  title?: string;
}
