import React from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { CartProvider } from "../../context/CartContext.js";
import CartPage from '../Cart/CartPage.js';
import DiscountMessage from '../DiscountMessages/DiscountMessage.js';
import Footer from '../Footer/Footer.js';
import GridSection from '../GridSection/GridSection.js';
import Header from '../Header/Header.js';
import Hero from '../Hero/Hero.js';
import ProductList from '../ProductList/ProductList.js';
import './App.css';

const App: React.FC = () => {
  // const homeItems = [
  //   { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Product 1" },
  //   { imgSrc: "/src/assets/img/Infographic.jpeg", description: "Product 2" },
  //   { saleText: "50% OFF!", isSale: true },
  //   { imgSrc: "/src/assets/img/Listing.jpeg", description: "Product 3" },
  // ];

  const womenItems = [
    { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Women Product 1" },
    { imgSrc: "assets/img/Lifestyle.jpeg", description: "Women Product 2" },
    { saleText: "New Arrivals!", isSale: true },
    { imgSrc: "assets/img/Lifestyle.jpeg", description: "Women Product 3" },
  ];

  const menItems = [
    { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Men Product 1" },
    { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Men Product 2" },
    { saleText: "Exclusive Offer!", isSale: true },
    { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Men Product 3" },
  ];

  const kidsItems = [
    { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Kids Product 1" },
    { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Kids Product 2" },
    { saleText: "Limited Edition!", isSale: true },
    { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Kids Product 3" },
  ];

  const saleItems = [
    { imgSrc: "/assets/img/Infographic.jpeg", description: "Sale Product 1" },
    { imgSrc: "/assets/img/Infographic.jpeg", description: "Sale Product 2" },
    { saleText: "Best Deals!", isSale: true },
    { imgSrc: "/assets/img/Lifestyle.jpeg", description: "Sale Product 3" },
  ];

  return (
  <CartProvider>
    <Router>
      <div className="App">
        <Header />
        
        <Routes>
          {/* Home Page */}
          <Route
            path="/"
            element={
               <Navigate to="/products"/>
            }
          />
            <Route path='/products' element={
            <>
            <ProductList/>
            </>
          }
          />
          {/* Women Page */}
          <Route
            path="/women"
            element={
              <>
                <Hero
                  image="/assets/img/women_placeholder.jpeg"
                  title="Empower Your Style"
                  description="Elegant, timeless, and coming soon."
                />
                <GridSection items={womenItems} />
              </>
            }
          />
            {/* Cart Page */}
            <Route path="/cart" element={<CartPage />} />
          {/* Men Page */}
          <Route
            path="/men"
            element={
              <>
                <Hero
                  image="/assets/img/Lifestyle .jpeg"
                  title="For the Modern Man"
                  description="Comfort meets style."
                />
                <GridSection items={menItems} />
              </>
            }
          />

          {/* Kids Page */}
          <Route
            path="/kids"
            element={
              <>
                <Hero
                  image="/assets/img/kids_placeholder.jpeg"
                  title="Fun & Functional"
                  description="Comfort for the little ones."
                />
                <GridSection items={kidsItems} />
              </>
            }
          />

          {/* Sale Page */}
          <Route
            path="/sale"
            element={
              <>
               <DiscountMessage/>
                <Hero
                  image="/assets/img/sale_placeholder.jpeg"
                  title="Limited Time Offers"
                  description="Grab the deals before they're gone!"
                />
                <GridSection items={saleItems} />
              </>
            }
          />

        </Routes>
        <Footer />
      </div>
    </Router>
  </CartProvider>
  );
};

export default App;
