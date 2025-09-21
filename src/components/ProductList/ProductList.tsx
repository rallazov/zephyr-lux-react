import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import "./ProductList.css";
interface Product{
  id: number;
  slug: string;
  name: string;
  price?: number;
  priceRange?: { min: number; max: number };
  fabricType: string;
  image: string;
  inStock: boolean;
}

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const { addToCart } = useCart();


  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/products.json');
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error('Error fetching products: ', error);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className="product-list">
      <h1>Product List</h1>
      <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {products.map((product) => (
          <div key={product.id} className="product-item">
            <Link to={`/product/${product.slug}`}>
              <img src={product.image} alt={product.name} style={{ width: '100%', height: 'auto' }} />
            </Link>
            <h3>
              <Link to={`/product/${product.slug}`}>{product.name}</Link>
            </h3>
            <p>{product.fabricType}</p>
            <p>
              {product.price !== undefined
                ? <>Price: ${product.price.toFixed(2)}</>
                : <>Price: ${product.priceRange?.min} - ${product.priceRange?.max}</>
              }
            </p>
            <button
              disabled={!product.inStock}
              className="product-item-button"
              onClick={() =>
              addToCart({ id: product.id, name: product.name, quantity: 1 ,price: (product.price ?? product.priceRange?.min ?? 0), image: product.image })
              }
            >
              {product.inStock ? 'Add to Cart' : 'Out of Stock'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductList;
