package com.appTest.bazar.services;

import com.appTest.bazar.dto.productSale.ProductSaleRequestDTO;
import com.appTest.bazar.dto.sale.*;
import com.appTest.bazar.models.Client;
import com.appTest.bazar.models.Product;
import com.appTest.bazar.models.ProductSale;
import com.appTest.bazar.models.Sale;
import com.appTest.bazar.repositories.IClientRepository;
import com.appTest.bazar.repositories.IProductRepository;
import com.appTest.bazar.repositories.ISaleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class SaleService implements ISaleService{

    @Autowired
    private ISaleRepository repoSale;

    @Autowired
    @Lazy
    private IClientRepository repoClient;

    @Autowired
    @Lazy
    private IProductRepository repoProd;

    @Override
    public List<Sale> getAllSales() {
        return repoSale.findAll();
    }

    @Override
    public Sale getSaleById(Long idSale) {
        return repoSale.findById(idSale).orElse(null);
    }

    @Override
    public SaleDTO convertSaleToDto(Sale sale) {
        String nameClient = (sale.getClient() != null) ? sale.getClient().getName() : "Name not found";
        String surnameClient = (sale.getClient() != null) ? sale.getClient().getSurname() : "Surname not found";

        String completeNameClient = nameClient + " " + surnameClient;

        return new SaleDTO(
                completeNameClient,
                sale.getDateSale(),
                sale.getTotal()
        );
    }

    @Override
    public SaleSummaryByDateDTO getSaleSummaryByDate(LocalDate date) {
        return repoSale.getSaleSummaryByDate(date);
    }

    @Override
    public SaleHighestDTO getHighestSale() {
        List<SaleHighestDTO> list = repoSale.getHighestSale();
        return list.isEmpty() ? null : list.get(0);
    }


    @Override
    public void createSale(SaleCreateDTO dto) {
        Sale sale = new Sale();
        sale.setDateSale(dto.getDateSale());

        Client client = repoClient.findById(dto.getClientId()).orElse(null);
        sale.setClient(client);

        List<ProductSale> productSaleList = new ArrayList<>();
        double totalAmount = 0.0;

        for (ProductSaleRequestDTO item : dto.getProducts()) {
            Product product = repoProd.findById(item.getProductId()).orElse(null);
            if (product != null) {
                ProductSale ps = new ProductSale();
                ps.setProduct(product);
                ps.setSale(sale);
                ps.setQuantity(item.getQuantity());
                ps.setPriceUni(product.getPrice());

                productSaleList.add(ps);

                totalAmount += product.getPrice() * item.getQuantity();


                product.setQuantityAvailable(product.getQuantityAvailable() - item.getQuantity());
            }
        }

        sale.setTotal(totalAmount);
        sale.setProductSaleList(productSaleList);

        repoSale.save(sale);
    }


    @Override
    public void updateSale(SaleUpdateDTO dto) {
            Sale sale = repoSale.findById(dto.getIdSale()).orElse(null);

            if (sale != null) {
                if (dto.getDateSale() != null) sale.setDateSale(dto.getDateSale());
                if (dto.getTotal() != null) sale.setTotal(dto.getTotal());

                if (dto.getClientId() != null) {
                    Client client = repoClient.findById(dto.getClientId()).orElse(null);
                    sale.setClient(client);
                };

                repoSale.save(sale);
            }
    }

    @Override
    public void deleteSaleById(Long idSale) {
            repoSale.deleteById(idSale);
    }
}
