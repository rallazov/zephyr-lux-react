import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import "./ProductList.css";
const ProductList = () => {
    const [products, setProducts] = useState([]);
    const { addToCart } = useCart();
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                // Try full catalog under /assets first; fallback to single-sample /products.json
                let data = [];
                try {
                    const resAssets = await fetch('/assets/products.json');
                    if (resAssets.ok) {
                        data = await resAssets.json();
                    }
                }
                catch { }
                if (!data?.length) {
                    const response = await fetch('/products.json');
                    data = await response.json();
                }
                setProducts(data);
            }
            catch (error) {
                console.error('Error fetching products: ', error);
            }
        };
        fetchProducts();
    }, []);
    return (_jsxs("div", { className: "product-list", children: [_jsx("h1", { children: "Product List" }), _jsx("div", { style: { display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }, children: products.map((product) => (_jsxs("div", { className: "product-item", children: [_jsx(Link, { to: `/product/${product.slug}`, children: _jsx("img", { src: product.image, alt: product.name, style: { width: '100%', height: 'auto' } }) }), _jsx("h3", { children: _jsx(Link, { to: `/product/${product.slug}`, children: product.name }) }), _jsx("p", { children: product.fabricType }), _jsx("p", { children: product.price !== undefined
                                ? _jsxs(_Fragment, { children: ["Price: $", product.price.toFixed(2)] })
                                : _jsxs(_Fragment, { children: ["Price: $", product.priceRange?.min, " - $", product.priceRange?.max] }) }), _jsx("button", { disabled: !product.inStock, className: "product-item-button", onClick: () => addToCart({ id: product.id, name: product.name, quantity: 1, price: (product.price ?? product.priceRange?.min ?? 0), image: product.image }), children: product.inStock ? 'Add to Cart' : 'Out of Stock' })] }, product.id))) })] }));
};
export default ProductList;
