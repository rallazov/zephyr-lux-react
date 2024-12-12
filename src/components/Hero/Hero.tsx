import React from 'react';
import { Link } from 'react-router-dom';
import './Hero.css'; // Ensure the correct path to CSS

interface HeroProps {
  image:string;
  title:string;
  description:string;
}

const Hero: React.FC<HeroProps> = ({image,title,description}) => {
  return (
    <section className="hero">
      <img src={image} alt="Hero Image" className="hero-img" />
      <div className="hero-content">
        <h2>{title}</h2>
        <p>{description}</p>
        <Link to="/sale" className="btn">Discover the Campaign</Link>
      </div>
    </section>
  );
};

export default Hero;
