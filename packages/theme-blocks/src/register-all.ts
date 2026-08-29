import { registerBlock } from '@sanvi/theme-runtime'
import ContactForm from './blocks/ContactForm.svelte'
import { contactFormSchema } from './blocks/ContactForm.schema'
import CTA from './blocks/CTA.svelte'
import { ctaSchema } from './blocks/CTA.schema'
import FAQ from './blocks/FAQ.svelte'
import { faqSchema } from './blocks/FAQ.schema'
import FeatureGrid from './blocks/FeatureGrid.svelte'
import { featureGridSchema } from './blocks/FeatureGrid.schema'
import Footer from './blocks/Footer.svelte'
import { footerSchema } from './blocks/Footer.schema'
import Header from './blocks/Header.svelte'
import { headerSchema } from './blocks/Header.schema'
import Hero from './blocks/Hero.svelte'
import { heroSchema } from './blocks/Hero.schema'
import ImageBanner from './blocks/ImageBanner.svelte'
import { imageBannerSchema } from './blocks/ImageBanner.schema'
import ProductGrid from './blocks/ProductGrid.svelte'
import { productGridSchema } from './blocks/ProductGrid.schema'
import RichText from './blocks/RichText.svelte'
import { richTextSchema } from './blocks/RichText.schema'
import Spacer from './blocks/Spacer.svelte'
import { spacerSchema } from './blocks/Spacer.schema'
import Testimonials from './blocks/Testimonials.svelte'
import { testimonialsSchema } from './blocks/Testimonials.schema'

export function registerAllBlocks(): void {
  registerBlock('hero', Hero, heroSchema)
  registerBlock('feature_grid', FeatureGrid, featureGridSchema)
  registerBlock('rich_text', RichText, richTextSchema)
  registerBlock('image_banner', ImageBanner, imageBannerSchema)
  registerBlock('product_grid', ProductGrid, productGridSchema)
  registerBlock('testimonials', Testimonials, testimonialsSchema)
  registerBlock('faq', FAQ, faqSchema)
  registerBlock('cta', CTA, ctaSchema)
  registerBlock('contact_form', ContactForm, contactFormSchema)
  registerBlock('footer', Footer, footerSchema)
  registerBlock('header', Header, headerSchema)
  registerBlock('spacer', Spacer, spacerSchema)
}
