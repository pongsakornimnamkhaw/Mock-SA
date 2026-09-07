export interface CustomerPromotionConcert {
  concert_id: string;
  concert_name: string;
  start_date: string;
  end_date: string;
  start_time: string;
  location: string;
  status: string;
  more_info?: string;
  poster_data?: string;
}

export interface CustomerPromotion {
  promotion_id: string;
  promotion_name: string;
  description: string;
  banner_image_url: string;
  terms: string;
  discount: {
    type: 'percent' | 'fixed';
    value: number;
    max_discount_amount: number;
    minimum_order: number;
    promo_code: string;
  };
  validity: {
    start_date: string;
    end_date: string;
    total_quota: number;
    used_quota: number;
    remaining_quota: number;
  };
  zones: Array<{ zone_id: string; zone_name: string }>;
  concert: CustomerPromotionConcert;
}

