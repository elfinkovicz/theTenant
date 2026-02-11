import { shopService, Product as ShopProduct, UploadUrlResponse } from './shop.service'

export interface Product {
  productId: string
  name: string
  description: string
  price: number
  imageKey?: string | null
  imageUrl?: string | null
  externalLink?: string | null
  category: string
  stock: number
  featured: boolean
  isExclusive?: boolean
  status?: 'draft' | 'published' | 'scheduled'
  scheduledAt?: string
  createdAt?: string
  updatedAt?: string
}

class ProductService {
  async getProducts(): Promise<Product[]> {
    try {
      const shopData = await shopService.getShop()
      
      // Convert ShopProduct to Product interface
      return shopData.products.map(p => ({
        productId: p.productId,
        name: p.name,
        description: p.description || '',
        price: p.price,
        imageKey: p.imageKey || null,
        imageUrl: p.imageUrl || null,
        externalLink: p.externalLink || null,
        category: p.category || '',
        stock: p.stock || 0,
        featured: p.featured || false,
        isExclusive: (p as any).isExclusive || false,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    } catch (error) {
      console.error('Failed to load products:', error)
      return []
    }
  }

  async createProduct(data: Partial<Product>): Promise<Product> {
    const shopData = await shopService.getShop()
    
    const newProduct: ShopProduct = {
      productId: data.productId || `product-${Date.now()}`,
      name: data.name || '',
      description: data.description,
      price: data.price || 0,
      currency: shopData.settings.currency,
      imageKey: data.imageKey || undefined,
      imageUrl: data.imageUrl || undefined,
      externalLink: data.externalLink || undefined,
      category: data.category,
      stock: data.stock,
      featured: data.featured || false,
      isExclusive: data.isExclusive || false,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as ShopProduct & { isExclusive?: boolean }
    
    await shopService.addProduct(newProduct)
    
    return {
      productId: newProduct.productId,
      name: newProduct.name,
      description: newProduct.description || '',
      price: newProduct.price,
      imageKey: newProduct.imageKey || null,
      imageUrl: newProduct.imageUrl || null,
      externalLink: newProduct.externalLink || null,
      category: newProduct.category || '',
      stock: newProduct.stock || 0,
      featured: newProduct.featured || false,
      createdAt: newProduct.createdAt,
      updatedAt: newProduct.updatedAt
    }
  }

  async updateProduct(productId: string, data: Partial<Product>): Promise<void> {
    const shopData = await shopService.getShop()
    
    const productIndex = shopData.products.findIndex(p => p.productId === productId)
    if (productIndex === -1) {
      throw new Error('Product not found')
    }
    
    const updatedProduct: ShopProduct = {
      ...shopData.products[productIndex],
      name: data.name || shopData.products[productIndex].name,
      description: data.description || shopData.products[productIndex].description,
      price: data.price || shopData.products[productIndex].price,
      imageKey: data.imageKey !== undefined ? (data.imageKey || undefined) : shopData.products[productIndex].imageKey,
      imageUrl: data.imageUrl !== undefined ? (data.imageUrl || undefined) : shopData.products[productIndex].imageUrl,
      externalLink: data.externalLink !== undefined ? (data.externalLink || undefined) : shopData.products[productIndex].externalLink,
      category: data.category || shopData.products[productIndex].category,
      stock: data.stock !== undefined ? data.stock : shopData.products[productIndex].stock,
      featured: data.featured !== undefined ? data.featured : shopData.products[productIndex].featured,
      isExclusive: data.isExclusive !== undefined ? data.isExclusive : (shopData.products[productIndex] as any).isExclusive,
      updatedAt: new Date().toISOString()
    } as ShopProduct & { isExclusive?: boolean }
    
    const updatedProducts = [...shopData.products]
    updatedProducts[productIndex] = updatedProduct
    
    await shopService.updateShop(updatedProducts, shopData.categories, shopData.settings)
  }

  async updateProducts(products: Product[]): Promise<void> {
    const shopData = await shopService.getShop()
    
    // Convert Product[] to ShopProduct[]
    const shopProducts: ShopProduct[] = products.map(p => ({
      productId: p.productId,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: shopData.settings.currency,
      imageKey: p.imageKey || undefined,
      imageUrl: p.imageUrl || undefined,
      externalLink: p.externalLink || undefined,
      category: p.category,
      stock: p.stock,
      featured: p.featured,
      isExclusive: p.isExclusive || false,
      status: 'published' as const,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as ShopProduct & { isExclusive?: boolean }))
    
    await shopService.updateShop(shopProducts, shopData.categories, shopData.settings)
  }

  async deleteProduct(productId: string): Promise<void> {
    await shopService.deleteProduct(productId)
  }

  async generateUploadUrl(fileName: string, fileType: string): Promise<UploadUrlResponse> {
    return shopService.generateUploadUrl(fileName, fileType)
  }

  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    return shopService.uploadToS3(uploadUrl, file)
  }
}

export const productService = new ProductService()
