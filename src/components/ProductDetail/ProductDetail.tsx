import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useCart } from "../../context/CartContext";

interface Product {
	id: number;
	slug: string;
	name: string;
	price?: number;
	priceRange?: { min: number; max: number };
	fabricType: string;
	image: string;
	inStock: boolean;
}

const ProductDetail: React.FC = () => {
	const { slug } = useParams<{ slug: string }>();
	const [product, setProduct] = useState<Product | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const { addToCart } = useCart();

	useEffect(() => {
		const load = async () => {
			try {
				const res = await fetch("/products.json");
				const data: Product[] = await res.json();
				const found = data.find((p) => p.slug === slug);
				if (!found) {
					setError("Product not found");
				} else {
					setProduct(found);
				}
			} catch (e) {
				setError("Failed to load product");
			} finally {
				setLoading(false);
			}
		};
		load();
	}, [slug]);

	if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
	if (error) return <div style={{ padding: 16 }}>{error}</div>;
	if (!product) return null;

	const price = product.price ?? product.priceRange?.min ?? 0;

	return (
		<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: 16 }}>
			<div>
				<img src={product.image} alt={product.name} style={{ width: "100%", height: "auto" }} />
			</div>
			<div>
				<h1 style={{ marginBottom: 8 }}>{product.name}</h1>
				<p style={{ color: "#666", marginBottom: 8 }}>{product.fabricType}</p>
				<p style={{ fontWeight: 600, marginBottom: 16 }}>${price.toFixed(2)}</p>
				<button
					disabled={!product.inStock}
					onClick={() => addToCart({ id: product.id, name: product.name, quantity: 1, price, image: product.image })}
					className="product-item-button"
				>
					{product.inStock ? "Add to Cart" : "Out of Stock"}
				</button>
			</div>
		</div>
	);
};

export default ProductDetail;


