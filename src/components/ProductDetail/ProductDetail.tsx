import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getDefaultCatalogAdapter } from "../../catalog/factory";
import type { CatalogProductDetail } from "../../catalog/types";
import { useCart } from "../../context/CartContext";

const ProductDetail: React.FC = () => {
	const { slug } = useParams<{ slug: string }>();
	const [row, setRow] = useState<CatalogProductDetail | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const { addToCart } = useCart();

	useEffect(() => {
		const load = async () => {
			if (!slug) {
				setError("Product not found");
				setLoading(false);
				return;
			}
			try {
				const adapter = getDefaultCatalogAdapter();
				const found = await adapter.getProductBySlug(slug);
				if (!found) {
					setError("Product not found");
				} else {
					setRow(found);
				}
			} catch {
				setError("Failed to load product");
			} finally {
				setLoading(false);
			}
		};
		void load();
	}, [slug]);

	if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
	if (error) return <div style={{ padding: 16 }}>{error}</div>;
	if (!row) return null;

	const { product, storefrontProductId } = row;
	const v0 = product.variants[0];
	const minC = Math.min(...product.variants.map((v) => v.price_cents));
	const priceDollars = minC / 100;
	const img = v0?.image_url ?? "";
	const inStock = product.variants.some((v) => v.inventory_quantity > 0);

	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: "1fr 1fr",
				gap: 24,
				padding: 16,
			}}
		>
			<div>
				<img src={img} alt={product.title} style={{ width: "100%", height: "auto" }} />
			</div>
			<div>
				<h1 style={{ marginBottom: 8 }}>{product.title}</h1>
				<p style={{ color: "#666", marginBottom: 8 }}>{product.fabric_type}</p>
				<p style={{ fontWeight: 600, marginBottom: 16 }}>${priceDollars.toFixed(2)}</p>
				<button
					disabled={!inStock}
					onClick={() =>
						addToCart({
							id: storefrontProductId,
							name: product.title,
							quantity: 1,
							price: priceDollars,
							image: img,
						})
					}
					className="product-item-button"
				>
					{inStock ? "Add to Cart" : "Out of Stock"}
				</button>
			</div>
		</div>
	);
};

export default ProductDetail;
