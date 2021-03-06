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

interface IFindProduct {
  id: string;
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Could not find customer');
    }

    const iFindProductsList = products.map<IFindProduct>(product => ({
      id: product.id,
    }));

    const productsList = await this.productsRepository.findAllById(
      iFindProductsList,
    );

    if (productsList.length !== products.length) {
      throw new AppError('Invalid product in the list.');
    }

    const productIds = products.map(product => {
      return { id: product.id };
    });

    const productsData = await this.productsRepository.findAllById(productIds);

    const productToOrder = productsData.map(product => {
      const index = products.findIndex(item => item.id === product.id);

      if (products[index].quantity > product.quantity) {
        throw new AppError(`insufficient stock for product "${product.name}"`);
      }

      return {
        product_id: product.id,
        price: product.price,
        quantity: products[index].quantity,
      };
    });

    await this.productsRepository.updateQuantity(products);

    const order = await this.ordersRepository.create({
      customer,
      products: productToOrder,
    });

    return order;
  }
}

export default CreateOrderService;
