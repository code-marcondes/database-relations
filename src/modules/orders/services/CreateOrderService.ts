import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject("OrdersRepository")
    private ordersRepository: IOrdersRepository,
    @inject("ProductsRepository")
    private productsRepository: IProductsRepository,
    @inject("CustomersRepository")
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);
    if(!customerExists){
      throw new AppError("Could not find any customer with the given id");
    }

    const existentsProducts = await this.productsRepository.findAllById(products);
    if(!existentsProducts.length){
      throw new AppError("Could not find any products with the given ids");
    }

    const existentsProductsId = existentsProducts.map(p => p.id);

    const inexistentsProducts = products.filter(p => !existentsProductsId.includes(p.id));
    if(inexistentsProducts.length) {
      throw new AppError(`Could not find products: ${inexistentsProducts}`);
    }

    const findProductsWithoutQuantityAvailable = products.filter(product =>
      existentsProducts.filter(p => p.id === product.id)[0].quantity < product.quantity,
    )
    if(findProductsWithoutQuantityAvailable.length) {
      throw new AppError(`The quantity ${findProductsWithoutQuantityAvailable}
      is not available for product ${findProductsWithoutQuantityAvailable}`);
    }

    const serializedProducts = products.map(p => ({
      product_id: p.id,
      quantity: p.quantity,
      price: existentsProducts.filter(product => product.id === p.id)[0].price,
    }))

    const order = await this.ordersRepository.create({customer: customerExists, products: serializedProducts});

    const { order_products } = order;

    const orderedProductQuantity = order_products.map(p => ({
      id: p.product_id,
      quantity: existentsProducts.filter(product => product.id === p.product_id)[0].quantity - p.quantity
    }));

    await this.productsRepository.updateQuantity(orderedProductQuantity);

    return order;
  }
}

export default CreateOrderService;
