export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      collection_item_tags: {
        Row: {
          item_id: string;
          tag_id: string;
          user_id: string;
        };
        Insert: {
          item_id: string;
          tag_id: string;
          user_id?: string;
        };
        Update: {
          item_id?: string;
          tag_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collection_item_tags_item_id_user_id_fkey';
            columns: ['item_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'collection_items';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'collection_item_tags_item_id_user_id_fkey';
            columns: ['item_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'collection_items_view';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'collection_item_tags_tag_id_user_id_fkey';
            columns: ['tag_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      collection_items: {
        Row: {
          acquired_at: string | null;
          category: Database['public']['Enums']['item_category'];
          created_at: string;
          currency: string | null;
          custom_data: Json | null;
          details: Json;
          estimated_value: number | null;
          external_id: string | null;
          format: string | null;
          format_key: string;
          id: string;
          metadata_overrides: Json;
          notes: string | null;
          ownership: Database['public']['Enums']['ownership_status'];
          provider: Database['public']['Enums']['metadata_provider'];
          purchase_price: number | null;
          quantity: number;
          source: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          acquired_at?: string | null;
          category: Database['public']['Enums']['item_category'];
          created_at?: string;
          currency?: string | null;
          custom_data?: Json | null;
          details?: Json;
          estimated_value?: number | null;
          external_id?: string | null;
          format?: string | null;
          format_key?: string;
          id?: string;
          metadata_overrides?: Json;
          notes?: string | null;
          ownership?: Database['public']['Enums']['ownership_status'];
          provider: Database['public']['Enums']['metadata_provider'];
          purchase_price?: number | null;
          quantity?: number;
          source?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          acquired_at?: string | null;
          category?: Database['public']['Enums']['item_category'];
          created_at?: string;
          currency?: string | null;
          custom_data?: Json | null;
          details?: Json;
          estimated_value?: number | null;
          external_id?: string | null;
          format?: string | null;
          format_key?: string;
          id?: string;
          metadata_overrides?: Json;
          notes?: string | null;
          ownership?: Database['public']['Enums']['ownership_status'];
          provider?: Database['public']['Enums']['metadata_provider'];
          purchase_price?: number | null;
          quantity?: number;
          source?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      metadata_cache: {
        Row: {
          category: Database['public']['Enums']['item_category'];
          external_id: string;
          fetched_at: string;
          image_url: string | null;
          payload: Json | null;
          provider: Database['public']['Enums']['metadata_provider'];
          release_year: number | null;
          subtitle: string | null;
          title: string;
        };
        Insert: {
          category: Database['public']['Enums']['item_category'];
          external_id: string;
          fetched_at?: string;
          image_url?: string | null;
          payload?: Json | null;
          provider: Database['public']['Enums']['metadata_provider'];
          release_year?: number | null;
          subtitle?: string | null;
          title: string;
        };
        Update: {
          category?: Database['public']['Enums']['item_category'];
          external_id?: string;
          fetched_at?: string;
          image_url?: string | null;
          payload?: Json | null;
          provider?: Database['public']['Enums']['metadata_provider'];
          release_year?: number | null;
          subtitle?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          default_currency: string;
          display_name: string | null;
          id: string;
          preferences: Json;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          default_currency?: string;
          display_name?: string | null;
          id: string;
          preferences?: Json;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          default_currency?: string;
          display_name?: string | null;
          id?: string;
          preferences?: Json;
        };
        Relationships: [];
      };
      scanned_files: {
        Row: {
          collection_item_id: string | null;
          device_id: string;
          file_modified_at: string | null;
          file_path: string;
          file_size: number | null;
          id: string;
          match_confidence: number | null;
          match_status: string;
          parsed_format: string | null;
          parsed_title: string | null;
          parsed_year: number | null;
          removed_at: string | null;
          scanned_at: string;
          user_id: string;
        };
        Insert: {
          collection_item_id?: string | null;
          device_id: string;
          file_modified_at?: string | null;
          file_path: string;
          file_size?: number | null;
          id?: string;
          match_confidence?: number | null;
          match_status?: string;
          parsed_format?: string | null;
          parsed_title?: string | null;
          parsed_year?: number | null;
          removed_at?: string | null;
          scanned_at?: string;
          user_id?: string;
        };
        Update: {
          collection_item_id?: string | null;
          device_id?: string;
          file_modified_at?: string | null;
          file_path?: string;
          file_size?: number | null;
          id?: string;
          match_confidence?: number | null;
          match_status?: string;
          parsed_format?: string | null;
          parsed_title?: string | null;
          parsed_year?: number | null;
          removed_at?: string | null;
          scanned_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'scanned_files_collection_item_id_user_id_fkey';
            columns: ['collection_item_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'collection_items';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'scanned_files_collection_item_id_user_id_fkey';
            columns: ['collection_item_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'collection_items_view';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      tags: {
        Row: {
          color: string | null;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          id?: string;
          name: string;
          user_id?: string;
        };
        Update: {
          color?: string | null;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      collection_items_view: {
        Row: {
          acquired_at: string | null;
          category: Database['public']['Enums']['item_category'] | null;
          created_at: string | null;
          currency: string | null;
          custom_data: Json | null;
          details: Json | null;
          estimated_value: number | null;
          external_id: string | null;
          format: string | null;
          id: string | null;
          image_url: string | null;
          metadata_fetched_at: string | null;
          metadata_overrides: Json | null;
          metadata_payload: Json | null;
          notes: string | null;
          ownership: Database['public']['Enums']['ownership_status'] | null;
          provider: Database['public']['Enums']['metadata_provider'] | null;
          provider_image_url: string | null;
          provider_release_year: number | null;
          provider_subtitle: string | null;
          provider_title: string | null;
          purchase_price: number | null;
          quantity: number | null;
          release_year: number | null;
          source: string | null;
          subtitle: string | null;
          title: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      assign_tag_to_items: {
        Args: { p_item_ids: string[]; p_tag_id: string };
        Returns: number;
      };
      collection_details_match: {
        Args: { p_details: Json; p_path: string; p_values: Json };
        Returns: boolean;
      };
      collection_escape_like: { Args: { p_text: string }; Returns: string };
      collection_facets: {
        Args: { p_filter?: Json };
        Returns: {
          facet: string;
          item_count: number;
          value: string;
        }[];
      };
      collection_filter_off: { Args: { p_values: Json }; Returns: boolean };
      collection_item_filter_flags: {
        Args: {
          p_acquired_at: string;
          p_category: Database['public']['Enums']['item_category'];
          p_details: Json;
          p_filter: Json;
          p_format: string;
          p_ownership: Database['public']['Enums']['ownership_status'];
          p_source: string;
          p_subtitle: string;
          p_tag_ids: string[];
          p_title: string;
        };
        Returns: boolean[];
      };
      collection_item_matches: {
        Args: {
          p_acquired_at: string;
          p_category: Database['public']['Enums']['item_category'];
          p_details: Json;
          p_filter: Json;
          p_format: string;
          p_ownership: Database['public']['Enums']['ownership_status'];
          p_source: string;
          p_subtitle: string;
          p_tag_ids: string[];
          p_title: string;
        };
        Returns: boolean;
      };
      collection_items_filtered: {
        Args: { p_filter?: Json };
        Returns: {
          acquired_at: string | null;
          category: Database['public']['Enums']['item_category'] | null;
          created_at: string | null;
          currency: string | null;
          custom_data: Json | null;
          details: Json | null;
          estimated_value: number | null;
          external_id: string | null;
          format: string | null;
          id: string | null;
          image_url: string | null;
          metadata_fetched_at: string | null;
          metadata_overrides: Json | null;
          metadata_payload: Json | null;
          notes: string | null;
          ownership: Database['public']['Enums']['ownership_status'] | null;
          provider: Database['public']['Enums']['metadata_provider'] | null;
          provider_image_url: string | null;
          provider_release_year: number | null;
          provider_subtitle: string | null;
          provider_title: string | null;
          purchase_price: number | null;
          quantity: number | null;
          release_year: number | null;
          source: string | null;
          subtitle: string | null;
          title: string | null;
          updated_at: string | null;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'collection_items_view';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      collection_stats: {
        Args: { p_time_zone?: string };
        Returns: {
          added_month: string;
          category: Database['public']['Enums']['item_category'];
          currency: string;
          estimated_value_total: number;
          item_count: number;
          ownership: Database['public']['Enums']['ownership_status'];
          quantity_total: number;
        }[];
      };
      merge_item_details: {
        Args: {
          p_category: Database['public']['Enums']['item_category'];
          p_id: string;
          p_patch: Json;
        };
        Returns: string[];
      };
      merge_item_overrides: {
        Args: { p_id: string; p_patch: Json };
        Returns: string[];
      };
      set_copy_defaults: {
        Args: {
          p_category: Database['public']['Enums']['item_category'];
          p_defaults: Json;
        };
        Returns: undefined;
      };
    };
    Enums: {
      item_category: 'movie' | 'tv' | 'music' | 'video_game' | 'board_game' | 'funko';
      metadata_provider: 'tmdb' | 'discogs' | 'igdb' | 'bgg' | 'custom';
      ownership_status: 'owned' | 'wishlist' | 'preordered' | 'loaned_out' | 'sold';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      item_category: ['movie', 'tv', 'music', 'video_game', 'board_game', 'funko'],
      metadata_provider: ['tmdb', 'discogs', 'igdb', 'bgg', 'custom'],
      ownership_status: ['owned', 'wishlist', 'preordered', 'loaned_out', 'sold'],
    },
  },
} as const;
