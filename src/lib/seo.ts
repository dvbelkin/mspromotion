type SeoLikeData = {
  title: string;
  descriptionShort: string;
  coverImage?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
};

export function resolveSeo(data: SeoLikeData, titleSuffix = " | MS Promotion") {
  return {
    title: data.seoTitle?.trim() || `${data.title}${titleSuffix}`,
    description: data.seoDescription?.trim() || data.descriptionShort,
    image: data.seoImage?.trim() || data.coverImage || "/uploads/og-default.jpg"
  };
}
