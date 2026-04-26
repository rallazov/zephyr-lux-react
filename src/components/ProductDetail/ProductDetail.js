import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useCart } from "../../context/CartContext";
const ProductDetail = () => {
    const { slug } = useParams();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { addToCart } = useCart();
    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/products.json");
                const data = await res.json();
                const found = data.find((p) => p.slug === slug);
                if (!found) {
                    setError("Product not found");
                }
                else {
                    setProduct(found);
                }
            }
            catch (e) {
                setError("Failed to load product");
            }
            finally {
                setLoading(false);
            }
        };
        load();
    }, [slug]);
    if (loading)
        return _jsx("div", { style: { padding: 16 }, children: "Loading\u2026" });
    if (error)
        return _jsx("div", { style: { padding: 16 }, children: error });
    if (!product)
        return null;
    const price = product.price ?? product.priceRange?.min ?? 0;
    return (_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: 16 }, children: [_jsx("div", { children: _jsx("img", { src: product.image, alt: product.name, style: { width: "100%", height: "auto" } }) }), _jsxs("div", { children: [_jsx("h1", { style: { marginBottom: 8 }, children: product.name }), _jsx("p", { style: { color: "#666", marginBottom: 8 }, children: product.fabricType }), _jsxs("p", { style: { fontWeight: 600, marginBottom: 16 }, children: ["$", price.toFixed(2)] }), _jsx("button", { disabled: !product.inStock, onClick: () => addToCart({ id: product.id, name: product.name, quantity: 1, price, image: product.image }), className: "product-item-button", children: product.inStock ? "Add to Cart" : "Out of Stock" })] })] }));
};
export default ProductDetail;
