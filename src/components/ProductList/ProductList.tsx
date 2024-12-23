import { useEffect, useState } from "react";

interface Product{
    id: number;
  name: string;
  priceRange: {
    min: number;
    max: number;
  };
  fabricType: string;
  image: string;
  inStock: boolean;
}
const ProductList = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/assets/products.json');
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error('Error fetching products: ', error);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div>
      <h1>Product List</h1>
      <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {products.map((product) => (
          <div key={product.id} style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '5px' }}>
            <img src={product.image} alt={product.name} style={{ width: '100%', height: 'auto' }} />
            <h3>{product.name}</h3>
            <p>{product.fabricType}</p>
            <p>
              Price: ${product.priceRange.min} - ${product.priceRange.max}
            </p>
            <button
              disabled={!product.inStock}
              style={{
                padding: '10px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
              }}
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
