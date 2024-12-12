import React from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import DiscountMessage from '../DiscountMessages/DiscountMessage.js';
import Footer from '../Footer/Footer.js';
import GridSection from '../GridSection/GridSection.js';
import Header from '../Header/Header.js';
import Hero from '../Hero/Hero.js';
import './App.css';

const App: React.FC = () => {
  const homeItems = [
    { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Product 1" },
    { imgSrc: "/src/assets/img/Infographic.jpeg", description: "Product 2" },
    { saleText: "50% OFF!", isSale: true },
    { imgSrc: "/src/assets/img/Listing.jpeg", description: "Product 3" },
  ];

  const womenItems = [
    { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Women Product 1" },
    { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Women Product 2" },
    { saleText: "New Arrivals!", isSale: true },
    { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Women Product 3" },
  ];

  const menItems = [
    { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Men Product 1" },
    { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Men Product 2" },
    { saleText: "Exclusive Offer!", isSale: true },
    { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Men Product 3" },
  ];

  const kidsItems = [
    { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Kids Product 1" },
    { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Kids Product 2" },
    { saleText: "Limited Edition!", isSale: true },
    { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Kids Product 3" },
  ];

  const saleItems = [
    { imgSrc: "/src/assets/img/Infographic.jpeg", description: "Sale Product 1" },
    { imgSrc: "/src/assets/img/Infographic.jpeg", description: "Sale Product 2" },
    { saleText: "Best Deals!", isSale: true },
    { imgSrc: "/src/assets/img/Lifestyle.jpeg", description: "Sale Product 3" },
  ];

  return (
    <Router>
      <div className="App">
        <Header />
        <Routes>
          {/* Home Page */}
          <Route
            path="/"
            element={
              <>
               <DiscountMessage/>
                <Hero
                  image="/src/assets/img/1 Lifestyle.jpeg"
                  title="Welcome to Zephyr Lux"
                  description="Explore our essentials."
                />
               
                <GridSection items={homeItems} />
              </>
            }
          />

          {/* Women Page */}
          <Route
            path="/women"
            element={
              <>
                <Hero
                  image="/src/assets/img/women_placeholder.jpeg"
                  title="Empower Your Style"
                  description="Elegant, timeless, and coming soon."
                />
                <GridSection items={womenItems} />
              </>
            }
          />

          {/* Men Page */}
          <Route
            path="/men"
            element={
              <>
                <Hero
                  image="/src/assets/img/men_placeholder.jpeg"
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
                  image="/src/assets/img/kids_placeholder.jpeg"
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
                  image="/src/assets/img/sale_placeholder.jpeg"
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
  );
};

export default App;
