"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(path: string): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<T>(path).then((res) => {
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error?.message ?? "Failed to load");
      }
      setLoading(false);
    });
  }, [path]);

  return { data, loading, error };
}
